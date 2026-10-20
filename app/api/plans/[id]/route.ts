import { z } from "zod";
import { getSession, readJson } from "@/lib/plans/session";
import { getPlan, listRequests, withPlanLock } from "@/lib/plans/repository";
import {
  changesSchema,
  selectionSchema,
  regeneratePlan,
  updateSelection,
} from "@/lib/plans/service";
import { errorResponse, PlanError } from "@/lib/plans/errors";

export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { owner } = await getSession();
    const [plan, requests] = await Promise.all([
      getPlan(id, owner),
      listRequests(id, owner),
    ]);
    return Response.json(
      { plan, requests },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const { owner } = await getSession();
    const body = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("requirements"),
          version: z.number().int(),
          changes: changesSchema,
        }),
        z.object({
          action: z.literal("selection"),
          version: z.number().int(),
          selection: selectionSchema,
        }),
      ])
      .parse(await readJson(request));
    const plan = await withPlanLock(id, owner, async (token) => {
      if ((await getPlan(id, owner)).version !== body.version)
        throw new PlanError(
          "This plan has changed. Reload before saving.",
          409,
        );
      return body.action === "requirements"
        ? regeneratePlan(id, owner, token, body.changes)
        : updateSelection(id, owner, token, body.selection);
    });
    return Response.json({ plan });
  } catch (error) {
    return errorResponse(error);
  }
}
