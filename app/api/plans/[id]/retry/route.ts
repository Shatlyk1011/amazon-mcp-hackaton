import { getSession, readJson } from "@/lib/plans/session";
import { withPlanLock } from "@/lib/plans/repository";
import { regeneratePlan } from "@/lib/plans/service";
import { errorResponse } from "@/lib/plans/errors";
export const maxDuration = 120;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await readJson(request);
    const { id } = await context.params;
    const { owner } = await getSession();
    return Response.json({
      plan: await withPlanLock(id, owner, (token) =>
        regeneratePlan(id, owner, token),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
