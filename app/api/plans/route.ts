import { z } from "zod";
import { relocationInputSchema } from "@/lib/relocation";
import { getSession, readJson } from "@/lib/plans/session";
import { createPlan, withPlanLock, getPlan } from "@/lib/plans/repository";
import { regeneratePlan } from "@/lib/plans/service";
import { errorResponse } from "@/lib/plans/errors";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = z
      .object({ input: relocationInputSchema, requestId: z.uuid() })
      .parse(await readJson(request));
    const { owner } = await getSession(true);
    const plan = await createPlan(owner, body.requestId, body.input);
    if (plan.status !== "ready") {
      try {
        await withPlanLock(plan.id, owner, (token) =>
          regeneratePlan(plan.id, owner, token),
        );
      } catch {
        /* A durable ID lets the user recover even if initial generation fails. */
      }
    }
    return Response.json(
      { plan: await getPlan(plan.id, owner) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
