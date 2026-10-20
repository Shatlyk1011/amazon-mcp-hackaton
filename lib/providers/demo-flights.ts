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
// Historical saved plans may contain live or unavailable results.
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

export async function searchFlightConnections(input: {
  origin: string;
  destination: string;
  departureDate: string;
  maxStops?: 0 | 1;
}): Promise<FlightScheduleResult> {
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
    fetchedAt: new Date().toISOString(),
    warning:
      "These are fictional examples for demonstration only, not actual airlines, airports, flights or available routes. Do not use them for travel decisions.",
  };
}
