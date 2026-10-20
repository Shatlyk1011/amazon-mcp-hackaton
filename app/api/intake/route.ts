import { z } from "zod";
import { intakeFieldsSchema } from "@/lib/intake/schema";
import {
  createIntake,
  latestIntake,
  readProfile,
} from "@/lib/intake/repository";
import { prepareIntake } from "@/lib/intake/service";
import { errorResponse } from "@/lib/plans/errors";
import { getSession, readJson } from "@/lib/plans/session";
export const maxDuration = 120;
const schema = z
  .object({
    requestId: z.uuid(),
    prompt: z.string().trim().max(4000).default(""),
    known: intakeFieldsSchema.default({}),
    includeContext: z.boolean().default(false),
    context: intakeFieldsSchema.optional(),
  })
  .strict();
export async function GET() {
  try {
    const { owner } = await getSession(true);
    return Response.json(
      { intake: await latestIntake(owner) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const { owner } = await getSession(true);
    const context = body.includeContext
      ? (body.context ?? (await readProfile(owner)))
      : {};
    const view = await prepareIntake(body.prompt, body.known, context);
    return Response.json(
      { intake: await createIntake(owner, body.requestId, view.state) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
