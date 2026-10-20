import "server-only";
import { z } from "zod";
import {
  calculateBudget,
  recommendations,
  relocationInputSchema,
} from "@/lib/relocation";
import { generatePlan } from "./generate";
import { getPlan, savePlan, markGenerationFailed } from "./repository";
import { PlanError } from "./errors";

export const changesSchema = relocationInputSchema.partial().strict();
export const selectionSchema = z
  .object({
    housingId: z.string().nullable().optional(),
    moverId: z.string().nullable().optional(),
  })
  .strict();

export async function regeneratePlan(
  id: string,
  owner: string,
  token: string,
  changes: z.infer<typeof changesSchema> = {},
) {
  const plan = await getPlan(id, owner);
  const input = relocationInputSchema.parse({
    ...plan.input,
    ...changesSchema.parse(changes),
  });
  try {
    const result = await generatePlan(input, {
      housingId: plan.result?.selectedHousingId,
      moverId: plan.result?.selectedMoverId,
    });
    return await savePlan(
      plan,
      owner,
      token,
      input,
      result,
      plan.result ? "Updated requirements and results" : "Initial generation",
    );
  } catch (error) {
    await markGenerationFailed(id, owner, token);
    throw error;
  }
}

export async function updateSelection(
  id: string,
  owner: string,
  token: string,
  raw: z.infer<typeof selectionSchema>,
) {
  const selection = selectionSchema.parse(raw);
  const plan = await getPlan(id, owner);
  if (!plan.result)
    throw new PlanError("Generate this plan before selecting an option.", 409);
  const housingId =
    selection.housingId === undefined
      ? plan.result.selectedHousingId
      : selection.housingId;
  const moverId =
    selection.moverId === undefined
      ? plan.result.selectedMoverId
      : selection.moverId;
  const housing = plan.result.housing.find((item) => item.id === housingId);
  if (housingId && !housing)
    throw new PlanError("That housing option is not in this plan.");
  if (moverId && !plan.result.movers.some((item) => item.id === moverId))
    throw new PlanError("That moving service is not in this plan.");
  return savePlan(
    plan,
    owner,
    token,
    plan.input,
    {
      ...plan.result,
      selectedHousingId: housingId,
      selectedMoverId: moverId,
      budget: calculateBudget(plan.input, housing),
      recommendations: recommendations(plan.input),
    },
    "Updated selections",
  );
}

// Keep geometry, images and large traces out of the model context.
export async function modelContext(id: string, owner: string) {
  const plan = await getPlan(id, owner);
  return {
    id: plan.id,
    version: plan.version,
    status: plan.status,
    input: plan.input,
    generatedAt: plan.result?.generatedAt,
    route: plan.result?.route && { ...plan.result.route, geometry: undefined },
    housing: plan.result?.housing
      .slice(0, 30)
      .map((listing) => ({ ...listing, image: undefined })),
    movers: plan.result?.movers.slice(0, 20),
    budget: plan.result?.budget,
    recommendations: plan.result?.recommendations,
    selectedHousingId: plan.result?.selectedHousingId,
    selectedMoverId: plan.result?.selectedMoverId,
    housingWarning: plan.result?.housingWarning,
    movingServicesWarning: plan.result?.movingServicesWarning,
  };
}
