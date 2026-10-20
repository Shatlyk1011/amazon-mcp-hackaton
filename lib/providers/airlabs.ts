import { geocodeMapboxPlace } from "./mapbox";

const apiBase = "https://airlabs.co/api/v9";

export type FlightSegment = {
  flightNumber: string;
  airline: string;
  originAirport: string;
  destinationAirport: string;
  departureTime?: string;
  arrivalTime?: string;
  days?: string[];
  departureAt?: string;
  arrivalAt?: string;
};
export type FlightConnection = {
  id: string;
  stops: number;
  layoverMinutes?: number;
  totalDurationMinutes?: number;
  segments: FlightSegment[];
};
export type FlightScheduleResult = {
  origin: string;
  destination: string;
  departureDate: string;
  originAirport?: string;
  destinationAirport?: string;
  connections: FlightConnection[];
  source: string;
  status: "live" | "fallback" | "unavailable";
  isDemoData?: boolean;
  fetchedAt: string;
  warning?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function airportCode(value: unknown): string | undefined {
  const code = text(value)?.toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined;
}

function normalizeSegment(raw: unknown): FlightSegment | null {
  const route = record(raw);
  const originAirport = airportCode(route.dep_iata);
  const destinationAirport = airportCode(route.arr_iata);
  const flightNumber = text(route.flight_iata);
  if (!originAirport || !destinationAirport || !flightNumber) return null;
  const days = Array.isArray(route.days)
    ? route.days.flatMap((day) => {
        const value = text(day)?.toLowerCase().slice(0, 3);
        return value &&
          ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(value)
          ? [value]
          : [];
      })
    : [];
  return {
    flightNumber,
    airline: text(route.airline_iata) ?? "Unknown airline",
    originAirport,
    destinationAirport,
    departureTime: text(route.dep_time),
    arrivalTime: text(route.arr_time),
    ...(days.length ? { days } : {}),
  };
}

async function request(
  path: string,
  params: Record<string, string>,
  key: string,
) {
  const query = new URLSearchParams({ ...params, api_key: key });
  const response = await fetch(`${apiBase}/${path}?${query}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AirLabs request failed.");
  const payload: unknown = await response.json();
  const envelope = record(payload);
  if (envelope.error) throw new Error("AirLabs request failed.");
  return "response" in envelope ? envelope.response : payload;
}

async function nearbyAirport(city: string, key: string) {
  const place = await geocodeMapboxPlace(city);
  if (!place)
    throw new Error(
      "Mapbox could not resolve a city; check MAPBOX_ACCESS_TOKEN and the selected cities.",
    );
  const payload = record(
    await request(
      "nearby",
      {
        lat: String(place.latitude),
        lng: String(place.longitude),
        distance: "75",
      },
      key,
    ),
  );
  if (!Array.isArray(payload.airports))
    throw new Error("AirLabs returned an invalid airport response.");
  for (const airport of payload.airports) {
    const code = airportCode(record(airport).iata_code);
    if (code) return code;
  }
  return null;
}

async function routes(params: Record<string, string>, key: string) {
  const payload = await request(
    "routes",
    { ...params, limit: "50", offset: "0" },
    key,
  );
  if (!Array.isArray(payload))
    throw new Error("AirLabs returned an invalid routes response.");
  return payload
    .map(normalizeSegment)
    .filter((route): route is FlightSegment => route !== null);
}

function simulated(
  input: Pick<
    FlightScheduleResult,
    "origin" | "destination" | "departureDate"
  > & { maxStops?: 0 | 1 },
  fetchedAt: string,
  warning: string,
): FlightScheduleResult {
  return {
    origin: input.origin,
    destination: input.destination,
    departureDate: input.departureDate,
    connections: [
      {
        id: "demo-direct",
        stops: 0,
        segments: [
          {
            flightNumber: "DEMO 101",
            airline: "Example airline",
            originAirport: input.origin,
            destinationAirport: input.destination,
          },
        ],
      },
      ...(input.maxStops === 0
        ? []
        : [
            {
              id: "demo-one-stop",
              stops: 1,
              segments: [
                {
                  flightNumber: "DEMO 201",
                  airline: "Example airline",
                  originAirport: input.origin,
                  destinationAirport: "Example transfer point",
                },
                {
                  flightNumber: "DEMO 202",
                  airline: "Example airline",
                  originAirport: "Example transfer point",
                  destinationAirport: input.destination,
                },
              ],
            },
          ]),
    ],
    source: "Simulated flight examples",
    status: "fallback",
    isDemoData: true,
    fetchedAt,
    warning: `${warning} These are fictional examples for demonstration only, not actual airlines, airports, flights or available routes. Do not use them for travel decisions.`,
  };
}

export async function searchFlightConnections(input: {
  origin: string;
  destination: string;
  departureDate: string;
  maxStops?: 0 | 1;
}): Promise<FlightScheduleResult> {
  const fetchedAt = new Date().toISOString();
  const key = process.env.AIRLABS_API_KEY;
  if (!key)
    return simulated(
      input,
      fetchedAt,
      "AIRLABS_API_KEY is not configured; no flight routes were requested.",
    );

  try {
    const [originAirport, destinationAirport] = await Promise.all([
      nearbyAirport(input.origin, key),
      nearbyAirport(input.destination, key),
    ]);
    if (!originAirport || !destinationAirport)
      return simulated(
        input,
        fetchedAt,
        "AirLabs could not find a nearby airport for one of these cities.",
      );
    const [direct, outbound, inbound] = await Promise.all([
      routes({ dep_iata: originAirport, arr_iata: destinationAirport }, key),
      input.maxStops === 0
        ? Promise.resolve([])
        : routes({ dep_iata: originAirport }, key),
      input.maxStops === 0
        ? Promise.resolve([])
        : routes({ arr_iata: destinationAirport }, key),
    ]);
    const date = new Date(`${input.departureDate}T12:00:00Z`);
    const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][
      date.getUTCDay()
    ];
    const operates = (route: FlightSegment) =>
      !route.days || route.days.includes(weekday!);
    const connections: FlightConnection[] = [];
    const add = (segments: FlightSegment[]) =>
      connections.push({
        id: segments
          .map(
            (segment) =>
              `${segment.flightNumber}-${segment.originAirport}-${segment.destinationAirport}`,
          )
          .join("-"),
        stops: segments.length - 1,
        segments,
      });
    for (const route of direct)
      if (
        route.originAirport === originAirport &&
        route.destinationAirport === destinationAirport &&
        operates(route)
      )
        add([route]);
    for (const first of outbound) {
      if (
        first.originAirport !== originAirport ||
        first.destinationAirport === originAirport ||
        first.destinationAirport === destinationAirport ||
        !operates(first)
      )
        continue;
      for (const second of inbound)
        if (
          second.originAirport === first.destinationAirport &&
          second.destinationAirport === destinationAirport
        )
          add([first, second]);
    }
    const unique = new Map(
      connections.map((connection) => [connection.id, connection]),
    );
    return {
      origin: input.origin,
      destination: input.destination,
      departureDate: input.departureDate,
      originAirport,
      destinationAirport,
      connections: [...unique.values()].slice(0, 8),
      source: "AirLabs · recurring routes",
      status: "live",
      fetchedAt,
      warning:
        "These are potential routes, not confirmed flights, fares or seat availability. Route data may be outdated or seasonal; verify operating dates, local times and transfer feasibility before booking. Results use the nearest listed airports and a limited sample of routes, so are not exhaustive.",
    };
  } catch (error) {
    const known =
      error instanceof Error &&
      [
        "Mapbox could not resolve a city; check MAPBOX_ACCESS_TOKEN and the selected cities.",
        "AirLabs returned an invalid airport response.",
        "AirLabs returned an invalid routes response.",
      ].includes(error.message);
    return simulated(
      input,
      fetchedAt,
      known
        ? (error as Error).message
        : "AirLabs route search failed. Check the API key, access and network connection.",
    );
  }
}
