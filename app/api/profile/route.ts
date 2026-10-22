import { readProfileText, writeProfileText } from "@/lib/intake/repository";
import { errorResponse } from "@/lib/plans/errors";
import { z } from "zod";
import { getSession, readJson } from "@/lib/plans/session";

export async function GET() {
  try {
    const { owner } = await getSession(true);
    return Response.json(
      { context: await readProfileText(owner) },
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
    return Response.json({
      context: await writeProfileText(
        owner,
        z
          .object({ text: z.string().max(8000) })
          .strict()
          .parse(body).text,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
