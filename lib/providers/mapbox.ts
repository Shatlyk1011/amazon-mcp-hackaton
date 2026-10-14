import { z } from "zod";

const geocodeResponseSchema = z.object({
  features: z.array(
    z.object({
      center: z.tuple([z.number(), z.number()]),
      place_name: z.string(),
    }),
  ),
});

const directionsResponseSchema = z.object({
  routes: z.array(
    z.object({
      distance: z.number(),
      duration: z.number(),
      geometry: z.unknown().optional(),
    }),
  ),
});

export type RouteResult = {
  origin: string;
  destination: string;
  distanceMiles: number;
  durationHours: number;
  source: string;
  status: "live" | "fallback";
  originCoordinates?: { longitude: number; latitude: number };
  destinationCoordinates?: { longitude: number; latitude: number };
  geometry?: unknown;
  fallbackReason?: string;
};

function fallbackRoute(
  origin: string,
  destination: string,
  reason: string,
): RouteResult {
  return {
    origin,
    destination,
    distanceMiles: 215,
    durationHours: 4.2,
    source: "Demo routing assumption",
    status: "fallback",
    fallbackReason: reason,
  };
}

async function geocode(query: string, token: string) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&limit=1&types=place,locality,region`,
    { cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Mapbox geocoding failed with ${response.status}`);
  const parsed = geocodeResponseSchema.parse(await response.json());
  const feature = parsed.features[0];
  if (!feature)
    throw new Error(`Mapbox could not find a location for ${query}`);
  return {
    label: feature.place_name,
    longitude: feature.center[0],
    latitude: feature.center[1],
  };
}

export async function calculateMapboxRoute(
  origin: string,
  destination: string,
): Promise<RouteResult> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token)
    return fallbackRoute(
      origin,
      destination,
      "MAPBOX_ACCESS_TOKEN is not configured",
    );
  console.log("origin, destination", origin, destination);
  try {
    const [from, to] = await Promise.all([
      geocode(origin, token),
      geocode(destination, token),
    ]);
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Mapbox directions failed with ${response.status}`);
    const parsed = directionsResponseSchema.parse(await response.json());
    const route = parsed.routes[0];

    console.log("route", route);
    console.log("from", from);
    console.log("to", to);
    if (!route) throw new Error("Mapbox returned no driving routes");
    return {
      origin: from.label,
      destination: to.label,
      distanceMiles: Math.round((route.distance / 1609.344) * 10) / 10,
      durationHours: Math.round((route.duration / 3600) * 100) / 100,
      source: "Mapbox Geocoding + Directions API",
      status: "live",
      originCoordinates: { longitude: from.longitude, latitude: from.latitude },
      destinationCoordinates: {
        longitude: to.longitude,
        latitude: to.latitude,
      },
      geometry: route.geometry,
    };
  } catch (error) {
    return fallbackRoute(
      origin,
      destination,
      error instanceof Error ? error.message : "Unknown Mapbox error",
    );
  }
}
