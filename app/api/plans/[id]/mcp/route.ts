import { getSession, checkOrigin } from "@/lib/plans/session";
import { getPlan } from "@/lib/plans/repository";
import { planMcpHandler } from "@/lib/plans/mcp";
import { errorResponse } from "@/lib/plans/errors";

export const maxDuration = 120;

async function handler(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const { id } = await context.params;
    const { owner } = await getSession();
    await getPlan(id, owner);
    return planMcpHandler(
      id,
      owner,
      request.headers.get("x-moveflow-operation") ?? undefined,
    )(request);
  } catch (error) {
    return errorResponse(error);
  }
}
export { handler as GET, handler as POST, handler as DELETE };
