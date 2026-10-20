import { relocationInputSchema } from "@/lib/relocation";
import { generatePlan } from "@/lib/plans/generate";
import { errorResponse } from "@/lib/plans/errors";
import { readJson } from "@/lib/plans/session";
import { z } from "zod";

// Legacy stateless workflow. Saved dashboard plans use /api/plans.
export async function POST(request: Request) {
  try {
    const body = z
      .object({
        input: relocationInputSchema,
        housingId: z.string().optional(),
        moverId: z.string().optional(),
      })
      .parse(await readJson(request));
    return Response.json(await generatePlan(body.input, body));
  } catch (error) {
    return errorResponse(error);
  }
}
