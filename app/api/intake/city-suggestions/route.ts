import { z } from "zod";
import { getCitySuggestions } from "@/lib/intake/service";
import { getSession, readJson } from "@/lib/plans/session";
import { errorResponse } from "@/lib/plans/errors";

export async function POST(request: Request) {
  try {
    await getSession();
    const { state } = z
      .object({ state: z.string().min(2).max(50) })
      .strict()
      .parse(await readJson(request));
    return Response.json({ cities: await getCitySuggestions(state) });
  } catch (error) {
    return errorResponse(error);
  }
}
