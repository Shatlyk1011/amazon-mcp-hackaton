import { readProfile, writeProfile } from "@/lib/intake/repository";
import { errorResponse } from "@/lib/plans/errors";
import { getSession, readJson } from "@/lib/plans/session";

export async function GET() {
  try {
    const { owner } = await getSession(true);
    return Response.json(
      { context: await readProfile(owner) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = await readJson(request);
    const { owner } = await getSession(true);
    return Response.json({ context: await writeProfile(owner, body) });
  } catch (error) {
    return errorResponse(error);
  }
}
