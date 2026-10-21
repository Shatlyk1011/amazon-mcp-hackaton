import type { PlanResult } from "@/lib/plans/types";
import type { Housing } from "@/lib/relocation";
import {
  assessMoveReadiness,
  buildMoveTimeline,
  createMoveBriefing,
} from "@/lib/relocation-insights";
import type { IntakeState } from "./schema";

const MAX_OPTIONS = 8;
const short = (value: string | undefined, max = 350) =>
  value?.slice(0, max) ?? "";
const dollars = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
const matchingHomes = (result: PlanResult) =>
  result.housing.filter(
    (home) =>
      result.housingStatus === "live" &&
      !/development/i.test(result.housingSource) &&
      !home.isDemoData &&
      home.monthlyRent > 0 &&
      home.monthlyRent <= result.input.maxRent &&
      home.bedrooms >= result.input.minBedrooms,
  );

export function safeSourceUrl(value: string | undefined) {
  if (!value || value.length > 2048) return undefined;
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function routePoints(result: PlanResult): number[][] {
  const geometry = result.route?.geometry as
    { type?: string; coordinates?: unknown[] } | undefined;
  if (geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates))
    return [];
  const points = geometry.coordinates.filter(
    (point): point is number[] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 180 &&
      Math.abs(point[1]) <= 85,
  );
  const step = Math.max(1, Math.ceil(points.length / 199));
  return points
    .filter((_, i) => i % step === 0 || i === points.length - 1)
    .map(([lng, lat]) => [Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
}

// Rendering data stays out of the model context. The server is the only party
// that uses the configured Mapbox token; the iframe receives image bytes.
export async function buildPlanMap(result: PlanResult) {
  const points = result.route?.status === "live" ? routePoints(result) : [];
  const fallback = {
    status: points.length > 1 ? "diagram" : "unavailable",
    points,
    caption:
      points.length > 1
        ? "Route diagram from Mapbox directions. Basemap unavailable; not for navigation."
        : "A live route map is unavailable. No sample route is shown.",
  };
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token || points.length < 2) return fallback;
  const sampled = points.filter(
    (_, i) =>
      i % Math.max(1, Math.ceil(points.length / 45)) === 0 ||
      i === points.length - 1,
  );
  const feature = {
    type: "Feature",
    properties: { stroke: "#286aa8", "stroke-width": 4 },
    geometry: { type: "LineString", coordinates: sampled },
  };
  try {
    const overlay = encodeURIComponent(JSON.stringify(feature));
    const response = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/geojson(${overlay})/auto/900x400?padding=45&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(4_000) },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/png") ||
      Number(response.headers.get("content-length") ?? 0) > 800_000
    )
      return fallback;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 800_000) return fallback;
    return {
      status: "map",
      image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
      caption: "Driving route · © Mapbox © OpenStreetMap",
    };
  } catch {
    return fallback;
  }
}

export async function buildHousingMap(result: PlanResult) {
  const homes = matchingHomes(result).slice(0, MAX_OPTIONS);
  if (!homes.length) return undefined;
  const fallback = {
    status: "unavailable",
    caption:
      "Rental map unavailable. Use the addresses in the comparison table.",
  };
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) return fallback;
  const pins = homes.flatMap((home, index) =>
    Number.isFinite(home.lng) &&
    Number.isFinite(home.lat) &&
    Math.abs(home.lng) <= 180 &&
    Math.abs(home.lat) <= 85
      ? [
          `pin-s-${index + 1}+286aa8(${home.lng.toFixed(5)},${home.lat.toFixed(5)})`,
        ]
      : [],
  );
  if (!pins.length) return fallback;
  try {
    const response = await fetch(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pins.join(",")}/auto/900x400?padding=70&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store", signal: AbortSignal.timeout(4_000) },
    );
    if (
      !response.ok ||
      !response.headers.get("content-type")?.startsWith("image/png") ||
      Number(response.headers.get("content-length") ?? 0) > 800_000
    )
      return fallback;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 800_000) return fallback;
    return {
      status: "map",
      image: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
      caption: "Numbers match the homes below · © Mapbox © OpenStreetMap",
    };
  } catch {
    return fallback;
  }
}

export function buildPlanPresentation(result: PlanResult, state: IntakeState) {
  const { input } = result;
  const matching = matchingHomes(result);
  const savedExamples =
    input.needsHousing &&
    (result.housingStatus !== "live" ||
      /development/i.test(result.housingSource))
      ? result.housing.filter(
          (home) =>
            home.monthlyRent > 0 &&
            home.monthlyRent <= input.maxRent &&
            home.bedrooms >= input.minBedrooms,
        )
      : [];
  const displayHome = (home: Housing) => ({
    id: short(home.id, 100),
    title: short(home.title, 150),
    address: short(home.address, 220),
    monthlyRent: home.monthlyRent,
    bedrooms: home.bedrooms,
    bathrooms: home.bathrooms,
    availability: home.availability,
    sourceUrl: safeSourceUrl(home.listingUrl),
  });
  const movers = result.movers.filter(
    (mover) =>
      result.movingServicesStatus === "live" &&
      !/development/i.test(result.movingServicesSource) &&
      !mover.isDemoData,
  );
  const snapshot = {
    input,
    routeAvailable: result.route?.status === "live",
    housingOptionsAvailable: matching.length > 0,
    movingServicesAvailable: movers.length > 0,
    selectedHousingId: null,
    selectedMoverId: null,
  };
  const assumptions = [
    ...(input.planningContext?.assumptions ?? []),
    ...(input.needsHousing &&
    state.fields.minBedrooms === undefined &&
    state.fields.bedrooms === undefined
      ? [
          "Bedroom preference was not confirmed; no minimum bedroom filter is applied.",
        ]
      : []),
    ...(state.fields.bedrooms === undefined
      ? [
          `Move-size estimates use ${input.bedrooms} bedroom(s); this was not separately confirmed.`,
        ]
      : []),
    ...(input.needsHousing
      ? [
          "Pet policies, move-in dates, fees, and availability must be confirmed with the listing provider. Links open address searches, not verified individual listing pages.",
        ]
      : []),
    "Budget and strategy amounts are planning allowances, not provider quotes. No home, mover, or travel has been booked.",
  ];
  const readiness = assessMoveReadiness(snapshot);
  // Do not repeat the budget inside readiness.
  const { budget: _budget, ...readinessSummary } = readiness;
  void _budget;
  const plan = {
    status: "ready" as const,
    persisted: false,
    state,
    generatedAt: result.generatedAt,
    move: {
      origin: input.origin,
      destination: input.destination,
      movingDate: input.movingDate,
      adults: input.adults,
      children: input.children,
      pets: input.pets,
      furniture: input.furniture,
      transport: input.transport,
      needsHousing: input.needsHousing,
      maxRent: input.maxRent,
      minBedrooms: input.minBedrooms,
    },
    route:
      result.route?.status === "live"
        ? {
            status: "live" as const,
            source: short(result.route.source),
            distanceMiles: result.route.distanceMiles,
            durationHours: result.route.durationHours,
          }
        : {
            status: "unavailable" as const,
            source: short(result.route?.source),
            warning:
              "Live driving directions are unavailable. Demo distances and times are omitted.",
          },
    housing: {
      status: result.housingStatus,
      source: short(result.housingSource),
      fetchedAt: result.housingFetchedAt,
      warning: short(result.housingWarning),
      totalMatches: matching.length,
      excludedCount: result.housing.length - matching.length,
      browseUrl: safeSourceUrl(result.housingBrowseUrl),
      options: matching.slice(0, MAX_OPTIONS).map(displayHome),
      examples: {
        total: savedExamples.length,
        locations: [
          ...new Set(
            savedExamples
              .map((home) => [home.city, home.state].filter(Boolean).join(", "))
              .filter(Boolean),
          ),
        ].slice(0, MAX_OPTIONS),
        options: savedExamples.slice(0, MAX_OPTIONS).map((home) => ({
          ...displayHome(home),
          availability: "Unknown" as const,
          fetchedAt: home.fetchedAt,
        })),
      },
    },
    movers: {
      status: /development/i.test(result.movingServicesSource)
        ? "unavailable"
        : result.movingServicesStatus,
      source: short(result.movingServicesSource),
      fetchedAt: result.movingServicesFetchedAt,
      warning: /development/i.test(result.movingServicesSource)
        ? "Stored development examples are excluded from live provider results."
        : short(result.movingServicesWarning),
      totalOptions: movers.length,
      options: movers.slice(0, MAX_OPTIONS).map((mover) => ({
        name: short(mover.name, 150),
        service: short(mover.service, 180),
        address: short(mover.address, 220),
        phone: short(mover.phone, 50),
        sourceUrl: safeSourceUrl(mover.website),
      })),
    },
    flights: result.flightSchedules
      ? {
          status: result.flightSchedules.status,
          source: short(result.flightSchedules.source),
          departureDate: result.flightSchedules.departureDate,
          isDemoData: result.flightSchedules.isDemoData ?? false,
          connections: result.flightSchedules.connections
            .slice(0, 4)
            .map((connection) => ({
              id: short(connection.id, 100),
              stops: connection.stops,
              segments: connection.segments.slice(0, 2).map((segment) => ({
                airline: short(segment.airline, 100),
                flightNumber: short(segment.flightNumber, 50),
                originAirport: short(segment.originAirport, 150),
                destinationAirport: short(segment.destinationAirport, 150),
                departureTime: short(segment.departureTime, 50),
                arrivalTime: short(segment.arrivalTime, 50),
              })),
            })),
        }
      : null,
    budget: result.budget,
    strategies: result.recommendations.slice(0, 3),
    timeline: buildMoveTimeline(input),
    readiness: readinessSummary,
    briefing: createMoveBriefing(snapshot),
    assumptions,
  };
  return plan;
}

export type MovePlanPresentation = ReturnType<typeof buildPlanPresentation>;

export function movePlanText(plan: MovePlanPresentation) {
  return [
    `MoveFlow moving plan: ${plan.move.origin} → ${plan.move.destination}`,
    `Move date: ${plan.move.movingDate}. ${plan.briefing.summary}`,
    ...(plan.move.transport === "fly"
      ? []
      : [
          plan.route.status === "live"
            ? `Driving route: ${plan.route.distanceMiles} miles, about ${plan.route.durationHours} hours (${plan.route.source}).`
            : plan.route.warning,
        ]),
    `Budget: ${dollars(plan.budget.recommended)} recommended allowance; ${dollars(plan.budget.budget)} available; ${plan.budget.remaining < 0 ? `${dollars(Math.abs(plan.budget.remaining))} gap` : `${dollars(plan.budget.remaining)} remaining`}. Housing upfront ${dollars(plan.budget.housingUpfront)}, travel ${dollars(plan.budget.transportation)}, moving ${dollars(plan.budget.moving)}, temporary accommodation ${dollars(plan.budget.temporaryAccommodation)}, other ${dollars(plan.budget.additional)}. Source: ${plan.budget.estimateSource === "model" ? "GPT planning estimates" : plan.budget.estimateSource === "user" ? "User-adjusted planning estimates" : "MoveFlow planning rules"}. Estimates, not quotes or verified market averages.`,
    plan.move.needsHousing
      ? `Housing: ${plan.housing.totalMatches} live options within ${dollars(plan.move.maxRent)}/month and at least ${plan.move.minBedrooms} bedrooms. ${plan.housing.excludedCount} sample or out-of-criteria results excluded.`
      : "Housing is already arranged; rental search was not requested.",
    ...plan.housing.options
      .slice(0, 3)
      .map(
        (home) =>
          `${home.title}: ${dollars(home.monthlyRent)}/month, ${home.bedrooms} bedrooms. ${home.sourceUrl ?? "Confirm with provider."}`,
      ),
    `Housing source: ${plan.housing.source} (${plan.housing.status}), checked ${plan.housing.fetchedAt}. ${plan.housing.warning}`,
    ...(plan.housing.examples.total
      ? [
          `Saved rental examples: ${plan.housing.examples.total} stored listings in ${plan.housing.examples.locations.join("; ") || "the saved dataset"}. These are not live matches for ${plan.move.destination}; current availability is unknown.`,
        ]
      : []),
    `Moving services: ${plan.movers.totalOptions} live options. Source: ${plan.movers.source} (${plan.movers.status}). ${plan.movers.warning}`,
    ...(plan.flights
      ? [
          `Flight examples for ${plan.move.origin} → ${plan.move.destination} on ${plan.flights.departureDate} (${plan.flights.source}${plan.flights.isDemoData ? "; fictional demo schedules" : ""}):`,
          ...plan.flights.connections.map((connection) =>
            connection.segments
              .map(
                (segment) =>
                  `${segment.airline} ${segment.flightNumber}: ${segment.originAirport} ${segment.departureTime} → ${segment.destinationAirport} ${segment.arrivalTime}`,
              )
              .join("; "),
          ),
        ]
      : []),
    `Next action: ${plan.readiness.nextAction}`,
    ...plan.timeline.timeline.map((task) => `${task.dueDate}: ${task.title}`),
    ...plan.assumptions,
    "Edit the expenses or move preferences in the app and select Update plan to refresh in place. This plan has not been saved to an account.",
  ]
    .filter(Boolean)
    .join("\n");
}
