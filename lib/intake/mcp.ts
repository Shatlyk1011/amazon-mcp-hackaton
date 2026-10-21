import type { McpServer } from "@modelcontextprotocol/server";
import { z, ZodError } from "zod";
import { usCitySchema, US_ONLY_ERROR } from "@/lib/us-location";
import { PlanError } from "@/lib/plans/errors";
import { generatePlan } from "@/lib/plans/generate";
import {
  buildHousingMap,
  buildPlanMap,
  buildPlanPresentation,
  movePlanText,
} from "./plan-result";
import { completeIntake, intakeView } from "./engine";
import {
  intakeAnswerSchema,
  intakeFieldsSchema,
  intakeStateSchema,
} from "./schema";
import { continueIntake, getRentGuidance, prepareIntake } from "./service";
import { quizHtml, quizResourceUri, resultResourceUri } from "./quiz-app";

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
async function output(work: () => Promise<unknown>) {
  try {
    const result = await work();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
      structuredContent: result as Record<string, unknown>,
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            error instanceof PlanError
              ? error.message
              : error instanceof ZodError &&
                  error.issues.some((issue) => issue.message === US_ONLY_ERROR)
                ? US_ONLY_ERROR
                : "The move intake could not be processed. Check the supplied details and retry.",
        },
      ],
    };
  }
}

// Public tools are stateless: the caller owns the explicit state snapshot.
// Browser sessions persist this same snapshot in the owner-scoped intake table.
export function registerIntakeTools(server: McpServer) {
  for (const resourceUri of [quizResourceUri, resultResourceUri]) {
    server.registerResource(
      resourceUri === quizResourceUri ? "move-quiz" : "move-plan",
      resourceUri,
      {
        title:
          resourceUri === quizResourceUri
            ? "Move setup quiz"
            : "Your moving plan",
        mimeType: "text/html;profile=mcp-app",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "text/html;profile=mcp-app",
            text: quizHtml,
            _meta: {
              "openai/widgetDescription":
                "MoveFlow renders the complete provider-backed moving plan: route map, housing comparison, budget, timeline, and sources. Avoid repeating the full plan outside the app.",
              ui: { csp: { connectDomains: [], resourceDomains: [] } },
            },
          },
        ],
      }),
    );
  }
  server.registerTool(
    "prepare_move_intake",
    {
      description:
        "Start an adaptive relocation interview from the user’s actual words and/or details the user explicitly provided. Leave unknown fields out of known; never invent or assume an origin, destination, or other answers. Do not answer questions or select options on the user’s behalf. Let the user complete the interactive quiz or ask them each returned question and wait for their answer before calling answer_move_intake. Returns ready, nextQuestion, summary and caller-owned state. Optional supplied savedContext is used only when includeContext is true. Does not read browser sessions or save data.",
      _meta: { ui: { resourceUri: quizResourceUri } },
      inputSchema: z.object({
        prompt: z.string().trim().max(4000).default(""),
        known: intakeFieldsSchema.default({}),
        savedContext: intakeFieldsSchema.default({}),
        includeContext: z.boolean().default(false),
      }),
      annotations,
    },
    (args) =>
      output(() =>
        prepareIntake(
          args.prompt,
          args.known,
          args.includeContext ? args.savedContext : {},
        ),
      ),
  );
  server.registerTool(
    "answer_move_intake",
    {
      description:
        "Record the user’s explicit answer to the current intake question using its choice ID, a free-text answer, or optional monthlyIncome for the rent question. Never choose or invent an answer for the user. Pass the latest state returned by prepare_move_intake or this tool. Uses the same validation and missing-information rules as the browser quiz. Income itself is not retained, only the user-selected 30% rent ceiling. Returns the next question or ready=true. Does not persist data.",
      inputSchema: z.object({
        state: intakeStateSchema,
        answer: intakeAnswerSchema,
      }),
      annotations,
    },
    (args) => output(() => continueIntake(args.state, args.answer)),
  );
  server.registerTool(
    "get_relocation_rent_guidance",
    {
      description:
        "Get a sourced local rent range from live listings for up to three cities. Returns sample size, date, 25th/50th/75th percentiles and limitations. Demo listings are excluded; unavailable data is explicit. Useful before asking a budget question or comparing destination costs. Does not save anything.",
      inputSchema: z.object({
        cities: z.array(usCitySchema).min(1).max(3),
        bedrooms: z.number().int().min(0).max(20),
      }),
      annotations,
    },
    (args) =>
      output(async () => ({
        guidance: await Promise.all(
          args.cities.map((city) => getRentGuidance(city, args.bedrooms)),
        ),
      })),
  );
  server.registerTool(
    "generate_move_plan",
    {
      description:
        "Generate and display the final MoveFlow moving plan from explicit intake state. The MCP App renders the server-authored map, housing comparison, budget, timeline, moving services, and provider limitations; text content is a ready-to-use fallback. Use this as the primary result, without an extra LLM call or web research to reconstruct the plan. Additional research is optional if the user requests it. If essential context is missing, returns needs_input and the exact next question instead of guessing. Standalone and non-persistent; no browser, database, or plan ID required.",
      _meta: {
        ui: { resourceUri: resultResourceUri, visibility: ["model", "app"] },
      },
      inputSchema: z.object({ state: intakeStateSchema }),
      annotations,
    },
    async ({ state }) => {
      try {
        const view = intakeView(state);
        if (!view.ready)
          return output(async () => ({ status: "needs_input", ...view }));
        const input = completeIntake(state);
        const result = await generatePlan(input);
        const plan = buildPlanPresentation(result, state);
        const [map, housingMap] = await Promise.all([
          buildPlanMap(result),
          buildHousingMap(result),
        ]);
        return {
          content: [{ type: "text" as const, text: movePlanText(plan) }],
          structuredContent: plan,
          _meta: { moveflow: { map, housingMap } },
        };
      } catch {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "The moving plan could not be generated. Your answers are still available; retry building the plan.",
            },
          ],
        };
      }
    },
  );
}
