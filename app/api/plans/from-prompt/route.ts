import { z } from "zod";
import { errorResponse } from "@/lib/plans/errors";
import {
  createIntake,
  getIntake,
  completeSavedIntake,
  readProfileText,
} from "@/lib/intake/repository";
import { prepareIntake } from "@/lib/intake/service";
import { getSession, readJson } from "@/lib/plans/session";

export const maxDuration = 120;

const requestSchema = z.object({
  prompt: z.string().trim().min(8).max(4_000),
  requestId: z.uuid(),
  includeContext: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await readJson(request));
    const { owner } = await getSession(true);
    const view = await prepareIntake(
      body.prompt,
      {},
      {},
      body.includeContext ? await readProfileText(owner) : "",
    );
    const intake = await createIntake(owner, body.requestId, view.state);
    if (!intake.ready)
      return Response.json({ status: "needs_input", intake }, { status: 202 });
    return Response.json(
      {
        plan: await completeSavedIntake(
          await getIntake(intake.id, owner),
          owner,
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
