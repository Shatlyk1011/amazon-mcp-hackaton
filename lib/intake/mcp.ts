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
  buildInteractiveMaps,
  buildPlanMap,
  buildPlanPresentation,
} from "./plan-result";
import {
  interactionModeSchema,
  presentIntake,
  presentPlan,
} from "./app-output";
import { applyIntakeFields, completeIntake, intakeView } from "./engine";
import {
  intakeAnswerSchema,
  intakeFieldsSchema,
  intakeStateSchema,
  type IntakeState,
  type IntakeView,
} from "./schema";
import {
  continueIntake,
  enrichIntake,
  getRentGuidance,
  prepareIntake,
} from "./service";
import { quizHtml, quizResourceUri, resultResourceUri } from "./quiz-app";
import { invalidateMovingEstimates } from "./estimate-expenses";

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
  interactionMode?: "widget" | "conversation",
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
    if (!view.ready) return presentIntake(view, interactionMode);
    const result = await generatePlan(completeIntake(latest));
    latest.expenseEstimates = result.input.expenseEstimates;
    const plan = buildPlanPresentation(result, latest);
    const [map, housingMap] = await Promise.all([
      buildPlanMap(result),
      buildHousingMap(result),
    ]);
    return presentPlan(plan, interactionMode, {
      map,
      housingMap,
      interactive: buildInteractiveMaps(result),
    });
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            error instanceof PlanError
              ? error.message
              : "The moving plan could not be generated. Your answers are still available; retry building the plan.",
        },
      ],
    };
  }
}
async function intakeOutput(
  work: () => Promise<IntakeView>,
  mode: "widget" | "conversation" | undefined,
) {
  const result = await output(work);
  if (result.isError) return result;
  return presentIntake(result.structuredContent as IntakeView, mode);
}
async function output(work: () => Promise<unknown>, text?: string) {
  try {
    const result = await work();
    return {
      content: [
        { type: "text" as const, text: text ?? JSON.stringify(result) },
      ],
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
                resourceUri === quizResourceUri
                  ? "MoveFlow displays an interactive quiz that presents the current question and options, collects each answer, advances the intake, and builds the moving plan. Do not repeat the question, options, or summary outside the widget."
                  : "MoveFlow renders an editable moving plan: maps, housing, estimated expenses, preferences, timeline, and sources. The Update plan button refreshes this app in place without posting a chat message.",
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: ["https://api.mapbox.com"],
                },
              },
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
        "Use this when someone wants help planning a move or relocation between US cities, such as “I’m moving from Boston to Austin” or “help me relocate to Denver.” Start an interactive moving-plan intake even if they do not mention MoveFlow. Include their actual words in prompt and put details explicitly stated in the current request in known. Also check available earlier conversation, user profile, or memory for relevant facts the user has provided, such as numbers of adults, children and pets, housing needs, accessibility and work preferences. Put applicable, sufficiently certain facts in savedContext and set includeContext to true so they can inform the move and avoid repeated questions. Send only relevant details the user intends to use for this move; do not send the full conversation or profile. Current request details override savedContext. Omit unknown, uncertain, outdated or conflicting facts; never invent or assume answers, including a breakdown of household members from a total alone. Do not use for a simple trip or flight search without a relocation request. If extractionWarning is returned, briefly mention it; let the widget review the details. Do not answer questions or select options on the user’s behalf. When the interactive widget is available, let it conduct the intake and build the plan; do not repeat its questions, options, or summary, create another quiz, or call answer_move_intake or generate_move_plan on its behalf. Respond only with a brief direction to use the MoveFlow widget. If the widget is unavailable or the user asks to continue in conversation, set interactionMode to conversation, ask only the returned nextQuestion and wait for their answer before calling answer_move_intake; when ready is true, call generate_move_plan without another confirmation. Widget mode returns confirmed state and progress; the questions are delivered only to the widget. Never infer that the widget failed just because no answer appears in chat. The server only uses context supplied in this call; it does not read the host’s conversation, browser sessions, profile or memory, and does not save data.",
      _meta: { ui: { resourceUri: quizResourceUri } },
      inputSchema: z.object({
        interactionMode: interactionModeSchema.default("widget"),
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
            "Relocation details explicitly supplied in the current request; these override savedContext. Omit unknown fields.",
          ),
        savedContext: intakeFieldsSchema
          .default({})
          .describe(
            "Relevant, sufficiently certain facts the user previously provided in available conversation, profile or memory, such as adults, children, pets and housing preferences. Include only facts applicable to this move; omit unknown or conflicting values. Set includeContext to true to use them.",
          ),
        includeContext: z
          .boolean()
          .default(false)
          .describe(
            "Set to true when supplying relevant user facts in savedContext. False ignores savedContext.",
          ),
      }),
      annotations,
    },
    (args) =>
      intakeOutput(
        () =>
          prepareIntake(
            args.prompt,
            args.known,
            args.includeContext ? args.savedContext : {},
          ),
        args.interactionMode,
      ),
  );
  server.registerTool(
    "answer_move_intake",
    {
      description:
        "Record the user’s explicit answer in MoveFlow. The widget calls this tool during interactive intake; do not call it to conduct a parallel chat interview. For an explicitly requested conversation fallback, set interactionMode to conversation, ask only the returned nextQuestion, and wait for the user’s answer. Pass the latest returned state. Never choose answers for the user. In conversation mode, call generate_move_plan when ready is true. Income itself is not retained, only the user-selected 30% rent ceiling. Does not persist data.",
      inputSchema: z
        .object({
          interactionMode: interactionModeSchema.optional(),
          state: intakeStateSchema,
          answer: intakeAnswerSchema.optional(),
          changes: intakeFieldsSchema
            .optional()
            .describe(
              "Explicit edits to confirmed answers in the widget. Supply either changes or answer, never both.",
            ),
        })
        .refine(
          (args) => Boolean(args.answer) !== Boolean(args.changes),
          "Supply either an answer or changes.",
        ),
      annotations,
    },
    (args) =>
      intakeOutput(
        () =>
          args.changes
            ? enrichIntake(applyIntakeFields(args.state, args.changes))
            : continueIntake(args.state, args.answer!),
        args.interactionMode,
      ),
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
        "Generate and display the editable MoveFlow moving plan from explicit intake state. The widget calls this after intake; do not generate a parallel plan while it is collecting answers. Set interactionMode to widget to display a plan, or conversation for an explicitly requested chat fallback. Omitting the mode preserves the full legacy response. Missing expense and strategy estimates are generated with OpenAI using the move details. These are planning estimates, not live quotes or verified market averages. Never invent user facts or overwrite applied user costs. If essential context is missing, returns needs_input and the next question. Stateless; no database or plan ID required.",
      _meta: {
        ui: { resourceUri: resultResourceUri, visibility: ["model", "app"] },
      },
      inputSchema: z.object({
        state: intakeStateSchema,
        interactionMode: interactionModeSchema.optional(),
        estimates: movingEstimatesSchema.optional(),
      }),
      annotations,
    },
    ({ state, estimates, interactionMode }) =>
      generateMoveResult(state, estimates, interactionMode),
  );
  server.registerTool(
    "update_move_plan",
    {
      description:
        "Apply the user's explicit expense or preference edits to the latest caller-owned state and regenerate the relocation plan, including housing searches, budget, readiness and timeline. Use interactionMode widget for updates in the app; conversation is an explicit chat fallback. Omitting the mode preserves the full legacy response. Pass only changed preferences in changes. Estimates are editable planning allowances, not quotes. User edits take precedence over GPT defaults. Returns the latest state in structuredContent.state for subsequent updates. Does not persist or book anything.",
      _meta: { ui: { visibility: ["model", "app"] } },
      inputSchema: z.object({
        state: intakeStateSchema,
        interactionMode: interactionModeSchema.optional(),
        changes: planChangesSchema.default({}),
        estimates: movingEstimatesSchema.optional(),
      }),
      annotations,
    },
    ({ state, changes, estimates, interactionMode }) => {
      const latest = applyIntakeFields(state, {
        ...changes,
        ...(changes.pets !== undefined
          ? { petFriendly: changes.pets > 0 }
          : {}),
      });
      if (Object.keys(changes).length)
        latest.expenseEstimates = invalidateMovingEstimates(
          state.expenseEstimates,
        );
      if (changes.pets === 0) delete latest.fields.petInfo;
      if (estimates)
        latest.expenseEstimates = {
          ...latest.expenseEstimates,
          ...estimates,
          source: "user",
        };
      return generateMoveResult(latest, undefined, interactionMode);
    },
  );
}
