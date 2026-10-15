import { NextResponse } from "next/server";
import {
  calculateBudget,
  calculateRoute,
  demoFamily,
  movers,
  recommendations,
  relocationInputSchema,
} from "@/lib/relocation";
import { searchHousing } from "@/lib/providers/rentcast";

export async function POST(request: Request) {
  const body = await request.json();
  const input = relocationInputSchema.parse(body.input ?? demoFamily);
  const start = Date.now();
  const [route, housingResult] = await Promise.all([
    calculateRoute(input),
    searchHousing({
      destination: input.destination,
      maxRent: input.maxRent,
      bedrooms: input.minBedrooms,
      petFriendly: input.petFriendly,
    }),
  ]);
  const housing = housingResult.listings;
  const selectedHousing = housing.find((item) => item.id === body.housingId);
  const selectedMover = movers.find((item) => item.id === body.moverId);
  const now = Date.now();
  const traces = [
    {
      tool: "create_relocation_plan",
      status: "completed",
      duration: now - start,
      output: { planId: `plan_${start}` },
    },
    {
      tool: "calculate_route",
      status: "completed",
      duration: now - start,
      output: route,
    },
    {
      tool: "search_housing",
      status: "completed",
      duration: now - start,
      output: housing,
      source: housingResult.source,
      dataStatus: housingResult.status,
    },
    {
      tool: "search_moving_services",
      status: "completed",
      duration: 0,
      output: movers,
    },
    {
      tool: "recommend_moving_strategy",
      status: "completed",
      duration: 0,
      output: recommendations(input),
    },
    {
      tool: "calculate_budget",
      status: "completed",
      duration: 0,
      output: calculateBudget(input, selectedHousing, selectedMover),
    },
  ];
  return NextResponse.json({
    input,
    route,
    housing,
    movers,
    recommendations: recommendations(input),
    budget: calculateBudget(input, selectedHousing, selectedMover),
    housingSource: housingResult.source,
    housingStatus: housingResult.status,
    housingWarning: housingResult.warning,
    housingBrowseUrl: housingResult.browseUrl,
    traces,
    selectedHousingId: selectedHousing?.id ?? null,
    selectedMoverId: selectedMover?.id ?? null,
  });
}
