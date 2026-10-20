import { z } from "zod";
import { intakeAnswersSchema } from "@/lib/intake/schema";
import {
  completeSavedIntake,
  getIntake,
  savedIntakeView,
  updateIntake,
} from "@/lib/intake/repository";
import { continueIntakeBatch } from "@/lib/intake/service";
import { errorResponse, PlanError } from "@/lib/plans/errors";
import { getSession, readJson } from "@/lib/plans/session";
export const maxDuration = 120;
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answers"),
    version: z.number().int(),
    answers: intakeAnswersSchema,
  }),
  z.object({ action: z.literal("back"), version: z.number().int() }),
  z.object({ action: z.literal("complete"), version: z.number().int() }),
]);
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { owner } = await getSession();
    const { id } = await context.params;
    return Response.json(
      { intake: savedIntakeView(await getIntake(id, owner)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const body = actionSchema.parse(await readJson(request));
    const { owner } = await getSession();
    const { id } = await context.params;
    const record = await getIntake(id, owner);
    if (body.action === "complete" && record.planId)
      return Response.json({ plan: await completeSavedIntake(record, owner) });
    if (record.version !== body.version || record.planId)
      throw new PlanError(
        "This move setup changed. Reload before continuing.",
        409,
      );
    if (body.action === "complete")
      return Response.json({ plan: await completeSavedIntake(record, owner) });
    if (body.action === "back") {
      const previous = record.history.at(-1);
      if (!previous)
        throw new PlanError("There is no earlier answer to edit.", 422);
      return Response.json({
        intake: await updateIntake(record, owner, previous, true),
      });
    }
    const view = await continueIntakeBatch(record.state, body.answers);
    return Response.json({
      intake: await updateIntake(record, owner, view.state),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
