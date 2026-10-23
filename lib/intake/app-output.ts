import { z } from "zod";
import type { IntakeView } from "./schema";
import type { buildPlanPresentation } from "./plan-result";
import { movePlanText } from "./plan-result";

export const interactionModeSchema = z
  .enum(["widget", "conversation"])
  .describe(
    "Use widget for the interactive MoveFlow app. Use conversation only when the user explicitly requests chat intake or the host cannot display the widget.",
  );
type InteractionMode = z.infer<typeof interactionModeSchema>;

const widgetInstruction =
  "MoveFlow owns the intake and builds the plan in the widget. Do not ask its questions, create another form, or restart intake. Keep any chat response to a brief direction to use MoveFlow. Switch to conversation mode only if the user asks or the widget cannot load.";

export function presentIntake(view: IntakeView, mode?: InteractionMode) {
  const status = view.ready ? "intake_ready" : "needs_input";
  if (mode !== "widget")
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ status, ...view }),
        },
      ],
      structuredContent: {
        status,
        ...view,
        ...(mode === "conversation"
          ? { interaction: { mode, owner: "chat" } }
          : {}),
      },
    };
  return {
    content: [
      {
        type: "text" as const,
        text: "Complete your move details in MoveFlow.",
      },
    ],
    structuredContent: {
      status: view.ready ? "building_plan" : "intake_in_progress",
      ready: view.ready,
      // Confirmed facts remain available for follow-ups and stateless tool calls.
      state: view.state,
      ...("extractionWarning" in view
        ? { extractionWarning: view.extractionWarning }
        : {}),
      interaction: {
        mode,
        owner: "moveflow",
        remainingQuestions: view.remainingQuestions,
        instruction: widgetInstruction,
      },
    },
    _meta: { moveflow: { view } },
  };
}

export function presentPlan(
  plan: ReturnType<typeof buildPlanPresentation>,
  mode: InteractionMode | undefined,
  maps: Record<string, unknown>,
) {
  // Older mounted widgets do not send a mode and still need the full result.
  if (mode !== "widget")
    return {
      content: [{ type: "text" as const, text: movePlanText(plan) }],
      structuredContent: {
        ...plan,
        ...(mode === "conversation"
          ? { interaction: { mode, owner: "chat" } }
          : {}),
      },
      _meta: { moveflow: maps },
    };
  return {
    content: [
      {
        type: "text" as const,
        text: "Your moving plan is ready in MoveFlow. Review and edit it there.",
      },
    ],
    structuredContent: {
      status: plan.status,
      state: plan.state,
      move: plan.move,
      budget: plan.budget,
      housing: plan.housing,
      nextAction: plan.readiness.nextAction,
      generatedAt: plan.generatedAt,
      interaction: {
        mode,
        owner: "moveflow",
        instruction:
          "The MoveFlow widget displays the completed plan. Do not restart intake, repeat its questions, or restate the whole plan. Answer follow-up questions using the confirmed state; apply changes only when requested.",
      },
    },
    _meta: { moveflow: { ...maps, view: plan } },
  };
}
