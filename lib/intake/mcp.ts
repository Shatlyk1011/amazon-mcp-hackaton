import type { McpServer } from "@modelcontextprotocol/server";
import { z, ZodError } from "zod";
import { usCitySchema, US_ONLY_ERROR } from "@/lib/us-location";
import { PlanError } from "@/lib/plans/errors";
import { generatePlan } from "@/lib/plans/generate";
import {
  movingEstimatesSchema,
  type MovingEstimates,
} from "@/lib/moving-estimates";
import {
  buildHousingMap,
  buildPlanMap,
  buildPlanPresentation,
  movePlanText,
} from "./plan-result";
import { applyIntakeFields, completeIntake, intakeView } from "./engine";
import {
  intakeAnswerSchema,
  intakeFieldsSchema,
  intakeStateSchema,
  type IntakeState,
} from "./schema";
import { continueIntake, getRentGuidance, prepareIntake } from "./service";
import { quizHtml, quizResourceUri, resultResourceUri } from "./quiz-app";
import { estimateMovingExpenses } from "./estimate-expenses";

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const planChangesSchema = intakeFieldsSchema.pick({
  movingDate: true,
  adults: true,
  children: true,
  pets: true,
  furniture: true,
  suitcases: true,
  transport: true,
  needsHousing: true,
  maxRent: true,
  minBedrooms: true,
  bedrooms: true,
  budget: true,
  otherNeeds: true,
});

async function generateMoveResult(
  state: IntakeState,
  estimates?: MovingEstimates,
) {
  try {
    const latest = intakeStateSchema.parse({
      ...state,
      // Model suggestions must never silently replace the user's applied costs.
      expenseEstimates:
        state.expenseEstimates?.source === "user"
          ? state.expenseEstimates
          : (estimates ?? state.expenseEstimates),
    });
    const view = intakeView(latest);
    if (!view.ready)
      return output(async () => ({ status: "needs_input", ...view }));
    if (!latest.expenseEstimates)
      latest.expenseEstimates = await estimateMovingExpenses(
        completeIntake(latest),
      );
    const result = await generatePlan(completeIntake(latest));
    const plan = buildPlanPresentation(result, latest);
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
}
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
                "MoveFlow renders an editable moving plan: maps, housing, estimated expenses, preferences, timeline, and sources. The Update my relocation plan button refreshes the plan and requests a concise updated chat response.",
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
        "Use this when someone wants help planning a move or relocation between US cities, such as “I’m moving from Boston to Austin” or “help me relocate to Denver.” Start an interactive moving-plan intake even if they do not mention MoveFlow. Use their actual words and explicitly provided details. Do not use for a simple trip or flight search without a relocation request. Leave unknown fields out of known; never invent or assume an origin, destination, or other answers. Do not answer questions or select options on the user’s behalf. Let the user complete the interactive quiz or ask them each returned question and wait for their answer before calling answer_move_intake. Returns ready, nextQuestion, summary and caller-owned state. Optional supplied savedContext is used only when includeContext is true. Does not read browser sessions or save data.",
      _meta: { ui: { resourceUri: quizResourceUri } },
      inputSchema: z.object({
        prompt: z
          .string()
          .trim()
          .max(4000)
          .default("")
          .describe(
            "The user’s relocation request in their own words, including any stated cities and preferences.",
          ),
        known: intakeFieldsSchema
          .default({})
          .describe(
            "Relocation details explicitly supplied by the user; omit unknown fields.",
          ),
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
        "Generate and display the editable MoveFlow moving plan from explicit intake state. Supply estimates with source=model for initial relocation cost assumptions based on the route, household and typical relocation prices. These are labeled GPT planning estimates, never live quotes or verified market averages. Keep estimated monthlyRent separate from the user's maxRent ceiling. Omitted amounts use MoveFlow planning rules. Never invent user facts or overwrite applied user costs. The app lets the user edit expenses and preferences, then call update_move_plan. Returns maps, housing, budget, timeline, services and provider limitations with a text fallback. If essential context is missing, returns needs_input and the next question. Stateless; no database or plan ID required.",
      _meta: {
        ui: { resourceUri: resultResourceUri, visibility: ["model", "app"] },
      },
      inputSchema: z.object({
        state: intakeStateSchema,
        estimates: movingEstimatesSchema.optional(),
      }),
      annotations,
    },
    ({ state, estimates }) => generateMoveResult(state, estimates),
  );
  server.registerTool(
    "update_move_plan",
    {
      description:
        "Apply the user's explicit expense or preference edits to the latest caller-owned state and regenerate the relocation plan, including housing searches, budget, readiness and timeline. Pass only changed preferences in changes. Estimates are editable planning allowances, not quotes. User edits take precedence over GPT defaults. Returns the latest state in structuredContent.state for subsequent updates. Does not persist or book anything.",
      _meta: { ui: { visibility: ["model", "app"] } },
      inputSchema: z.object({
        state: intakeStateSchema,
        changes: planChangesSchema.default({}),
        estimates: movingEstimatesSchema.optional(),
      }),
      annotations,
    },
    ({ state, changes, estimates }) => {
      const latest = applyIntakeFields(state, {
        ...changes,
        ...(changes.pets !== undefined
          ? { petFriendly: changes.pets > 0 }
          : {}),
      });
      if (changes.pets === 0) delete latest.fields.petInfo;
      if (estimates)
        latest.expenseEstimates = {
          ...state.expenseEstimates,
          ...estimates,
          source: "user",
        };
      return generateMoveResult(latest);
    },
  );
}
