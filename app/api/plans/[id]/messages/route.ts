import { z } from "zod";
import { getSession, readJson } from "@/lib/plans/session";
import { handlePlanMessage } from "@/lib/plans/agent";
import { errorResponse } from "@/lib/plans/errors";

export const maxDuration = 180;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const body = z
      .object({
        message: z.string().trim().min(1).max(4000),
        requestId: z.uuid(),
      })
      .strict()
      .parse(await readJson(request));
    const { id } = await context.params;
    const { owner, token } = await getSession();
    return Response.json(
      await handlePlanMessage(id, owner, token, body.message, body.requestId),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
