import {
  calculateBudget,
  calculateRoute,
  recommendations,
  type RelocationInput,
} from "@/lib/relocation";
import { searchHousing } from "@/lib/providers/rentcast";
import { searchFlightConnections } from "@/lib/providers/demo-flights";
import { searchMovingServices } from "@/lib/providers/tomtom-search";

export async function generatePlan(
  input: RelocationInput,
  selection: { housingId?: string | null; moverId?: string | null } = {},
) {
  const start = Date.now();
  const [route, housingResult, flightSchedules] = await Promise.all([
    input.transport === "fly" ? Promise.resolve(null) : calculateRoute(input),
    input.needsHousing
      ? searchHousing({
          destination: input.destination,
          maxRent: input.maxRent,
          bedrooms: input.minBedrooms || undefined,
          petFriendly: input.petFriendly,
        })
      : Promise.resolve({
          listings: [],
          source: "Not requested",
          status: "unavailable" as const,
          fetchedAt: new Date().toISOString(),
          warning:
            "Housing is already arranged; rental search was not requested.",
          browseUrl: "https://www.zillow.com/",
        }),
    input.transport === "drive"
      ? Promise.resolve(null)
      : searchFlightConnections({
          origin: input.origin,
          destination: input.destination,
          departureDate: input.movingDate,
          maxStops: 1,
        }),
  ]);
  const movingServicesResult = await searchMovingServices({
    origin: input.origin,
    destination: input.destination,
    furniture: input.furniture,
    originCoordinates: route?.originCoordinates,
  });
  const housing = housingResult.listings;
  const movers = movingServicesResult.movers;
  const selectedHousing = housing.find(
    (item) => item.id === selection.housingId,
  );
  const selectedMover = movers.find((item) => item.id === selection.moverId);
  const now = Date.now();
  const traces = [
    ...(route
      ? [
          {
            tool: "calculate_route",
            status: "completed",
            duration: now - start,
            output: route,
          },
        ]
      : []),
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
      duration: now - start,
      output: movers,
      source: movingServicesResult.source,
      dataStatus: movingServicesResult.status,
    },
    ...(flightSchedules
      ? [
          {
            tool: "suggest_flight_connections",
            status: "completed",
            duration: Date.now() - start,
            output: flightSchedules,
            source: flightSchedules.source,
            dataStatus: flightSchedules.status,
          },
        ]
      : []),
    {
      tool: "calculate_budget",
      status: "completed",
      duration: 0,
      output: calculateBudget(input, selectedHousing),
    },
  ];
  return {
    input,
    route,
    housing,
    movers,
    flightSchedules,
    recommendations: recommendations(input),
    budget: calculateBudget(input, selectedHousing),
    housingSource: housingResult.source,
    housingStatus: housingResult.status,
    housingFetchedAt: housingResult.fetchedAt,
    housingWarning: housingResult.warning,
    housingBrowseUrl: housingResult.browseUrl,
    movingServicesSource: movingServicesResult.source,
    movingServicesStatus: movingServicesResult.status,
    movingServicesFetchedAt: movingServicesResult.fetchedAt,
    movingServicesWarning: movingServicesResult.warning,
    traces,
    generatedAt: new Date().toISOString(),
    selectedHousingId: selectedHousing?.id ?? null,
    selectedMoverId: selectedMover?.id ?? null,
  };
}
