import { z } from "zod";
import { DEMO_MOVERS } from "@/data";
import type { Mover } from "@/lib/relocation";

const tomTomSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      type: z.literal("POI"),
      id: z.string(),
      dist: z.number().optional(),
      poi: z.object({
        name: z.string(),
        phone: z.string().optional(),
        url: z.string().optional(),
        categories: z.array(z.string()).optional(),
      }),
      address: z.object({ freeformAddress: z.string().optional() }).optional(),
    }),
  ),
});

export type MovingServiceSearchInput = {
  origin: string;
  destination: string;
  furniture: boolean;
  originCoordinates?: { longitude: number; latitude: number };
};

export type MovingServiceSearchResult = {
  movers: Mover[];
  source: string;
  status: "live" | "unavailable";
  fetchedAt: string;
  warning?: string;
};

function searchQuery(input: MovingServiceSearchInput) {
  return input.furniture ? "moving company" : "moving services";
}

function normalizedWebsite(url?: string) {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export async function searchMovingServices(
  input: MovingServiceSearchInput,
): Promise<MovingServiceSearchResult> {
  const fetchedAt = new Date().toISOString();

  if (process.env.NODE_ENV === "development") {
    return {
      movers: DEMO_MOVERS,
      source: "TomTom Search API · development response",
      status: "live",
      fetchedAt,
    };
  }

  const token = process.env.TOMTOM_API_KEY;

  if (!token) {
    return {
      movers: [],
      source: "TomTom Search API",
      status: "unavailable",
      fetchedAt,
      warning:
        "TOMTOM_API_KEY is not configured; no moving services can be shown.",
    };
  }

  const query = input.originCoordinates
    ? searchQuery(input)
    : `${searchQuery(input)} near ${input.origin}`;
  const params = new URLSearchParams({
    key: token,
    idxSet: "POI",
    countrySet: "US",
    limit: "10",
    maxFuzzyLevel: "4",
  });

  if (input.originCoordinates) {
    params.set("lat", String(input.originCoordinates.latitude));
    params.set("lon", String(input.originCoordinates.longitude));
    params.set("radius", "50000");
  }

  try {
    const response = await fetch(
      `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`TomTom Search request failed with ${response.status}`);

    const payload = tomTomSearchResponseSchema.parse(await response.json());
    const movers = payload.results.map((place): Mover => ({
      id: place.id,
      name: place.poi.name,
      service: place.poi.categories?.join(" · ") ?? "Moving service",
      address: place.address?.freeformAddress,
      phone: place.poi.phone,
      website: normalizedWebsite(place.poi.url),
      distanceMiles:
        place.dist === undefined
          ? undefined
          : Math.round((place.dist / 1609.344) * 10) / 10,
      isDemoData: false,
    }));

    return {
      movers,
      source: "TomTom Search API",
      status: "live",
      fetchedAt,
    };
  } catch (error) {
    return {
      movers: [],
      source: "TomTom Search API",
      status: "unavailable",
      fetchedAt,
      warning:
        error instanceof Error ? error.message : "TomTom Search request failed",
    };
  }
}
