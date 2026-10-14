import { NextResponse } from "next/server";
import {
  calculateBudget,
  calculateRoute,
  demoFamily,
  housing,
  movers,
  recommendations,
  relocationInputSchema,
} from "@/lib/relocation";

export async function POST(request: Request) {
  const body = await request.json();
  const input = relocationInputSchema.parse(body.input ?? demoFamily);
  const selectedHousing = housing.find((item) => item.id === body.housingId);
  const selectedMover = movers.find((item) => item.id === body.moverId);
  const start = Date.now();
  const route = await calculateRoute(input);
  const traces = [
    {
      tool: "create_relocation_plan",
      status: "completed",
      duration: 42,
      output: { planId: `plan_${start}` },
    },
    {
      tool: "calculate_route",
      status: "completed",
      duration: 68,
      output: route,
    },
    {
      tool: "search_housing",
      status: "completed",
      duration: 104,
      output: housing,
    },
    {
      tool: "search_moving_services",
      status: "completed",
      duration: 91,
      output: movers,
    },
    {
      tool: "recommend_moving_strategy",
      status: "completed",
      duration: 77,
      output: recommendations(input),
    },
    {
      tool: "calculate_budget",
      status: "completed",
      duration: 33,
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
    traces,
    selectedHousingId: selectedHousing?.id ?? null,
    selectedMoverId: selectedMover?.id ?? null,
  });
}
