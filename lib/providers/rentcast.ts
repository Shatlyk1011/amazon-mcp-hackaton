import { z } from "zod";
import { DEMO_HOUSES } from "@/data";
import { housingListingUrl, type Housing } from "@/lib/relocation";

const rentCastListingSchema = z.record(z.string(), z.unknown());

export type HousingSearchInput = {
  destination: string;
  maxRent?: number;
  bedrooms?: number;
  petFriendly?: boolean;
  liveOnly?: boolean;
};

export type HousingSearchResult = {
  listings: Housing[];
  source: string;
  status: "live" | "unavailable";
  fetchedAt: string;
  warning?: string;
  browseUrl: string;
};

function browseUrl(destination: string) {
  return `https://www.zillow.com/homes/for_rent/${encodeURIComponent(destination)}/`;
}

function parseDestination(destination: string) {
  const match = destination.trim().match(/^(.*?)(?:,\s*([A-Za-z]{2}))?$/);
  return {
    city: match?.[1]?.trim() ?? destination.trim(),
    state: match?.[2]?.toUpperCase(),
  };
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeListing(
  listing: Record<string, unknown>,
  index: number,
  destination: string,
): Housing | null {
  const latitude = toNumber(listing.latitude ?? listing.lat);
  const longitude = toNumber(listing.longitude ?? listing.lng ?? listing.lon);
  const monthlyRent = toNumber(listing.price ?? listing.monthlyRent);
  if (
    latitude === undefined ||
    longitude === undefined ||
    monthlyRent === undefined
  )
    return null;

  const address = String(
    listing.formattedAddress ??
      listing.addressLine1 ??
      listing.address ??
      destination,
  );
  const city = String(listing.city ?? destination);
  const state = String(listing.state ?? "");
  const title = String(
    listing.title ??
      listing.name ??
      listing.propertyName ??
      listing.addressLine1 ??
      listing.formattedAddress ??
      address,
  );
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const image = photos.find(
    (photo): photo is string => typeof photo === "string",
  );
  const normalized: Housing = {
    id: String(listing.id ?? listing.propertyId ?? `rentcast-${index}`),
    title,
    address,
    monthlyRent,
    bedrooms: toNumber(listing.bedrooms) ?? 0,
    bathrooms: toNumber(listing.bathrooms) ?? 0,
    image: image ?? "",
    availability: "Listed as available",
    listingUrl: "",
    isDemoData: false,
    lat: latitude,
    lng: longitude,
    source: "RentCast",
    city,
    state,
    fetchedAt: new Date().toISOString(),
  };

  return { ...normalized, listingUrl: housingListingUrl(normalized) };
}

export async function searchHousing(
  input: HousingSearchInput,
): Promise<HousingSearchResult> {
  const fetchedAt = new Date().toISOString();
  const token = process.env.RENTCAST_API_KEY;
  const useDevelopmentData =
    !input.liveOnly && process.env.NODE_ENV !== "production";
  if (useDevelopmentData || !token) {
    return {
      listings: input.liveOnly ? [] : DEMO_HOUSES,
      source: input.liveOnly ? "RentCast" : "RentCast · development response",
      status: "unavailable",
      fetchedAt,
      warning: input.liveOnly
        ? "Live rental guidance requires RENTCAST_API_KEY."
        : useDevelopmentData
          ? "Using the development response from data.ts"
          : "RENTCAST_API_KEY is not configured; showing the development response from data.ts",
      browseUrl: browseUrl(input.destination),
    };
  }

  const destination = parseDestination(input.destination);
  const params = new URLSearchParams({
    status: "Active",
    limit: "50",
  });
  if (destination.city) params.set("city", destination.city);
  if (destination.state) params.set("state", destination.state);
  if (input.maxRent !== undefined)
    params.set("maxPrice", String(input.maxRent));
  if (input.bedrooms !== undefined)
    params.set("bedrooms", String(input.bedrooms));
  if (input.petFriendly) params.set("petsAllowed", "true");

  try {
    const response = await fetch(
      `https://api.rentcast.io/v1/listings/rental/long-term?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "X-Api-Key": token,
        },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(`RentCast request failed with ${response.status}`);
    const payload: unknown = await response.json();
    const rawListings = Array.isArray(payload)
      ? payload
      : z.object({ listings: z.array(rentCastListingSchema) }).parse(payload)
          .listings;
    const listings = rawListings
      .map((listing, index) =>
        normalizeListing(listing, index, input.destination),
      )
      .filter((listing): listing is Housing => Boolean(listing));
    return {
      listings,
      source: "RentCast",
      status: "live",
      fetchedAt,
      browseUrl: browseUrl(input.destination),
    };
  } catch (error) {
    return {
      listings: [],
      source: "RentCast",
      status: "unavailable",
      fetchedAt,
      warning:
        error instanceof Error ? error.message : "RentCast request failed",
      browseUrl: browseUrl(input.destination),
    };
  }
}
