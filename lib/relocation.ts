import { z } from "zod";
import { movingEstimatesSchema } from "@/lib/moving-estimates";
import { usCitySchema } from "@/lib/us-location";
import { calculateMapboxRoute, type RouteResult } from "@/lib/providers/mapbox";

export const relocationInputSchema = z.object({
  scenario: z.enum(["alone", "family"]),
  origin: usCitySchema,
  destination: usCitySchema,
  movingDate: z.iso.date(),
  flexible: z.boolean(),
  budget: z.number().nonnegative().optional(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  pets: z.number().int().nonnegative(),
  bedrooms: z.number().int().positive(),
  suitcases: z.number().int().nonnegative(),
  furniture: z.boolean(),
  transport: z.enum(["drive", "fly", "compare"]),
  needsHousing: z.boolean(),
  maxRent: z.number().nonnegative(),
  minBedrooms: z.number().int().nonnegative(),
  petFriendly: z.boolean(),
  neighborhood: z.string().max(300).optional(),
  expenseEstimates: movingEstimatesSchema.optional(),
  planningContext: z
    .object({
      includedSavedContext: z.boolean(),
      workInfo: z.string().max(1500).optional(),
      petInfo: z.string().max(1000).optional(),
      accessibilityNeeds: z.string().max(1000).optional(),
      otherNeeds: z.string().max(1500).optional(),
      sources: z.record(z.string(), z.string()),
      assumptions: z.array(z.string()),
      rentEvidence: z
        .object({
          destination: z.string(),
          bedrooms: z.number(),
          sampleSize: z.number(),
          source: z.string(),
          fetchedAt: z.string(),
          low: z.number().optional(),
          median: z.number().optional(),
          high: z.number().optional(),
          explanation: z.string(),
        })
        .optional(),
    })
    .optional(),
});

export type RelocationInput = z.infer<typeof relocationInputSchema>;

export type Housing = {
  id: string;
  title: string;
  address: string;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
  image: string;
  availability: "Listed as available" | "Unknown";
  listingUrl: string;
  isDemoData: boolean;
  lat: number;
  lng: number;
  source?: string;
  city?: string;
  state?: string;
  fetchedAt?: string;
};

export function housingListingUrl(
  listing: Pick<Housing, "address" | "title" | "city" | "state">,
) {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const searchLocation = location || listing.address;
  const searchQuery = listing.title.trim() || listing.address;
  return `https://www.zillow.com/homes/for_rent/${encodeURIComponent(searchLocation)}/?searchQuery=${encodeURIComponent(searchQuery)}`;
}

export type Mover = {
  id: string;
  name: string;
  service: string;
  address?: string;
  phone?: string;
  distanceMiles?: number;
  rating?: number;
  userRatingCount?: number;
  website?: string;
  googleMapsUrl?: string;
  isDemoData: boolean;
};

export async function calculateRoute(
  input: Pick<RelocationInput, "origin" | "destination">,
): Promise<RouteResult> {
  return calculateMapboxRoute(input.origin, input.destination);
}

export function recommendations(input: RelocationInput) {
  const family = input.scenario === "family";
  const estimates = input.expenseEstimates;
  if (
    estimates?.cheapestStrategy === undefined ||
    estimates.recommendedStrategy === undefined ||
    estimates.comfortableStrategy === undefined
  )
    throw new Error("Moving strategy estimates are unavailable.");
  const strategies = [
    {
      id: "cheapest",
      label: "Cheapest",
      transport: family ? "Drive + truck rental" : "Drive",
      service: family ? "Truck rental" : "Self-move",
      cost: estimates.cheapestStrategy,
      explanation: family
        ? "Driving and loading your own truck keeps the cash cost down for a furnished move."
        : "With a couple of suitcases, a full-service mover would add cost without solving a real need.",
      advantages: ["Lowest starting cost", "Flexible timing"],
      tradeoffs: ["More hands-on work"],
    },
    {
      id: "recommended",
      label: "Recommended",
      transport: "Drive (compare flying)",
      service: family ? "Moving labor + truck" : "No mover",
      cost: estimates.recommendedStrategy,
      explanation: family
        ? "A truck plus loading help balances control, comfort, and the furniture you need to move."
        : "Compare driving and flying while leaving room in the budget for deposits and setup.",
      advantages: ["Balanced cost and effort", "Room for extra costs"],
      tradeoffs: ["Needs planning"],
    },
    {
      id: "comfortable",
      label: "Most comfortable",
      transport: family ? "Fly + ship furniture" : "Fly",
      service: family ? "Full-service movers" : "Door-to-door help",
      cost: estimates.comfortableStrategy,
      explanation: family
        ? "Professional packing and transport reduce disruption for children and a pet."
        : "Flying is fastest when your move fits in luggage and a small shipment.",
      advantages: ["Least physical effort", "Fastest arrival"],
      tradeoffs: ["Highest estimate"],
    },
  ];
  return strategies.map((strategy, index) => ({
    ...strategy,
    service: input.furniture
      ? ["Truck rental", "Moving labor + truck", "Full-service movers"][index]
      : "No mover needed",
    transport:
      input.transport === "drive"
        ? [
            "Drive + self-move",
            "Drive with loading help",
            "Drive with planned overnight stops",
          ][index]
        : input.transport === "fly"
          ? [
              "Fly economy",
              "Fly and arrange luggage or shipping",
              "Fly + door-to-door support",
            ][index]
          : strategy.transport,
    explanation:
      input.transport === "compare"
        ? strategy.explanation
        : `${input.transport === "drive" ? "Driving" : "Flying"} matches your travel choice. ${input.furniture ? "Compare ways to move your furniture separately." : "Plan for your luggage instead of a full household move."} ${strategy.label === "Cheapest" ? "This option focuses on keeping costs down." : strategy.label === "Recommended" ? "This option balances cost and effort." : "This option focuses on help and comfort."}`,
  }));
}

export function calculateBudget(
  input: RelocationInput,
  selectedHousing?: Pick<Housing, "monthlyRent">,
) {
  const estimates = input.expenseEstimates;
  if (
    !estimates ||
    estimates.monthlyRent === undefined ||
    estimates.housingFees === undefined ||
    estimates.includeSecurityDeposit === undefined ||
    estimates.transportation === undefined ||
    estimates.moving === undefined ||
    estimates.additional === undefined ||
    estimates.temporaryAccommodation === undefined ||
    estimates.minimalNonHousing === undefined ||
    estimates.fullServiceNonHousing === undefined
  )
    throw new Error("Moving expense estimates are unavailable.");
  const monthlyRent = input.needsHousing
    ? (selectedHousing?.monthlyRent ?? estimates.monthlyRent)
    : 0;
  const includeSecurityDeposit = estimates.includeSecurityDeposit;
  const housingFees = input.needsHousing ? estimates.housingFees : 0;
  const securityDeposit = includeSecurityDeposit ? monthlyRent : 0;
  const housingUpfront = monthlyRent + securityDeposit + housingFees;
  const transportation = estimates.transportation;
  const movingAllowance = input.furniture ? estimates.moving : 0;
  const additional = estimates.additional;
  const temporaryAccommodation = estimates.temporaryAccommodation;
  const base = Math.round(
    housingUpfront +
      transportation +
      movingAllowance +
      additional +
      temporaryAccommodation,
  );
  return {
    budget: input.budget ?? null,
    minimal: Math.round(housingUpfront + estimates.minimalNonHousing),
    recommended: base,
    fullService: Math.round(housingUpfront + estimates.fullServiceNonHousing),
    housingUpfront,
    monthlyRent,
    securityDeposit,
    includeSecurityDeposit,
    housingFees,
    temporaryAccommodation,
    estimateSource: estimates.source,
    transportation,
    moving: movingAllowance,
    additional,
    remaining: input.budget === undefined ? null : input.budget - base,
  };
}

export const demoFamily: RelocationInput = {
  scenario: "family",
  origin: "Boston, MA",
  destination: "New York, NY",
  movingDate: "2026-11-15",
  flexible: true,
  budget: 8000,
  adults: 2,
  children: 1,
  pets: 1,
  bedrooms: 2,
  suitcases: 8,
  furniture: true,
  transport: "compare",
  needsHousing: true,
  maxRent: 3800,
  minBedrooms: 2,
  petFriendly: true,
  neighborhood: "Brooklyn",
};
