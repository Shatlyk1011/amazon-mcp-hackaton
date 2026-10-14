import { z } from "zod";
import { calculateMapboxRoute, type RouteResult } from "@/lib/providers/mapbox";

export const relocationInputSchema = z.object({
  scenario: z.enum(["alone", "family"]),
  origin: z.string().min(2),
  destination: z.string().min(2),
  movingDate: z.string(),
  flexible: z.boolean(),
  budget: z.number().nonnegative(),
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
  neighborhood: z.string().optional(),
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
};

export type Mover = {
  id: string;
  name: string;
  service: string;
  costMin: number;
  costMax: number;
  pricing: "Estimated pricing" | "Published starting price";
  website: string;
  isDemoData: boolean;
};

export const housing: Housing[] = [
  {
    id: "h1",
    title: "Park Slope light-filled two bedroom",
    address: "225 5th Ave, Brooklyn, NY",
    monthlyRent: 3350,
    bedrooms: 2,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
    availability: "Listed as available",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.672,
    lng: -73.977,
  },
  {
    id: "h2",
    title: "Astoria garden apartment",
    address: "31-18 35th St, Queens, NY",
    monthlyRent: 2900,
    bedrooms: 2,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
    availability: "Listed as available",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.756,
    lng: -73.923,
  },
  {
    id: "h3",
    title: "Williamsburg loft",
    address: "88 Berry St, Brooklyn, NY",
    monthlyRent: 4100,
    bedrooms: 2,
    bathrooms: 2,
    image:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80",
    availability: "Unknown",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.716,
    lng: -73.961,
  },
  {
    id: "h4",
    title: "Washington Heights one bedroom",
    address: "655 W 178th St, New York, NY",
    monthlyRent: 2400,
    bedrooms: 1,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=80",
    availability: "Listed as available",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.848,
    lng: -73.936,
  },
  {
    id: "h5",
    title: "Carroll Gardens brownstone",
    address: "142 Sackett St, Brooklyn, NY",
    monthlyRent: 3600,
    bedrooms: 2,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80",
    availability: "Unknown",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.679,
    lng: -73.999,
  },
  {
    id: "h6",
    title: "Long Island City skyline home",
    address: "44-72 11th St, Queens, NY",
    monthlyRent: 3950,
    bedrooms: 2,
    bathrooms: 2,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
    availability: "Listed as available",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.747,
    lng: -73.949,
  },
  {
    id: "h7",
    title: "Upper West Side classic",
    address: "410 W 86th St, New York, NY",
    monthlyRent: 4550,
    bedrooms: 2,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80",
    availability: "Unknown",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.789,
    lng: -73.976,
  },
  {
    id: "h8",
    title: "Bed-Stuy sunlit flat",
    address: "617 Lafayette Ave, Brooklyn, NY",
    monthlyRent: 3200,
    bedrooms: 2,
    bathrooms: 1,
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=80",
    availability: "Listed as available",
    listingUrl: "https://www.zillow.com/",
    isDemoData: true,
    lat: 40.689,
    lng: -73.947,
  },
];

export const movers: Mover[] = [
  {
    id: "m1",
    name: "Harbor & Vine Moving",
    service: "Full-service movers",
    costMin: 2350,
    costMax: 3200,
    pricing: "Estimated pricing",
    website: "https://www.moving.com/",
    isDemoData: true,
  },
  {
    id: "m2",
    name: "U-Pack Relocation",
    service: "Storage / container shipping",
    costMin: 1700,
    costMax: 2400,
    pricing: "Published starting price",
    website: "https://www.upack.com/",
    isDemoData: true,
  },
  {
    id: "m3",
    name: "U-Haul 20' truck",
    service: "Truck rental",
    costMin: 980,
    costMax: 1450,
    pricing: "Estimated pricing",
    website: "https://www.uhaul.com/",
    isDemoData: true,
  },
  {
    id: "m4",
    name: "Neighborly Loaders",
    service: "Moving labor",
    costMin: 620,
    costMax: 980,
    pricing: "Estimated pricing",
    website: "https://www.hireahelper.com/",
    isDemoData: true,
  },
  {
    id: "m5",
    name: "PODS City Transfer",
    service: "Storage / container shipping",
    costMin: 2100,
    costMax: 2900,
    pricing: "Published starting price",
    website: "https://www.pods.com/",
    isDemoData: true,
  },
];

export async function calculateRoute(
  input: Pick<RelocationInput, "origin" | "destination">,
): Promise<RouteResult> {
  return calculateMapboxRoute(input.origin, input.destination);
}

export function recommendations(input: RelocationInput) {
  const family = input.scenario === "family";
  const moveBase = input.furniture ? (family ? 2350 : 1500) : 0;
  return [
    {
      id: "cheapest",
      label: "Cheapest",
      transport: family ? "Drive + truck rental" : "Train or bus",
      service: family ? "Truck rental" : "Self-move",
      cost: Math.round(
        (family ? 980 : 180) + moveBase * 0.35 + input.pets * 120,
      ),
      explanation: family
        ? "Driving and loading your own truck keeps the cash cost down for a furnished move."
        : "With a couple of suitcases, a full-service mover would add cost without solving a real need.",
      advantages: ["Lowest upfront cost", "Flexible timing"],
      tradeoffs: ["More hands-on work"],
    },
    {
      id: "recommended",
      label: "Recommended",
      transport: family ? "Drive (compare flying)" : "Train",
      service: family ? "Moving labor + truck" : "No mover",
      cost: Math.round(
        (family ? 1680 : 320) + moveBase * 0.55 + input.pets * 150,
      ),
      explanation: family
        ? "A truck plus loading help balances control, comfort, and the furniture you need to move."
        : "Rail keeps the trip simple and leaves more of the budget for deposits and setup.",
      advantages: ["Balanced cost and effort", "Clear contingency"],
      tradeoffs: ["Requires planning"],
    },
    {
      id: "comfortable",
      label: "Most comfortable",
      transport: family ? "Fly + ship furniture" : "Fly",
      service: family ? "Full-service movers" : "Door-to-door help",
      cost: Math.round((family ? 3100 : 780) + moveBase + input.pets * 220),
      explanation: family
        ? "Professional packing and transport reduce disruption for children and a pet."
        : "Flying is fastest when your move fits in luggage and a small shipment.",
      advantages: ["Least physical effort", "Fastest arrival"],
      tradeoffs: ["Highest estimate"],
    },
  ];
}

export function calculateBudget(
  input: RelocationInput,
  selectedHousing?: Housing,
  selectedMover?: Mover,
) {
  const housingUpfront = selectedHousing
    ? selectedHousing.monthlyRent * 2 + 250
    : input.needsHousing
      ? input.maxRent * 2 + 250
      : 0;
  const travel =
    input.transport === "fly"
      ? (input.adults + input.children) * 280 + input.pets * 180
      : input.scenario === "family"
        ? 520
        : 180;
  const moving = selectedMover
    ? (selectedMover.costMin + selectedMover.costMax) / 2
    : input.furniture
      ? input.scenario === "family"
        ? 1800
        : 950
      : 0;
  const supplies = input.furniture
    ? input.scenario === "family"
      ? 420
      : 180
    : 40;
  const pet = input.pets * 180;
  const base = Math.round(housingUpfront + travel + moving + supplies + pet);
  return {
    budget: input.budget,
    minimal: Math.round(base * 0.78),
    recommended: base,
    fullService: Math.round(base * 1.35),
    housingUpfront,
    monthlyRent:
      selectedHousing?.monthlyRent ?? (input.needsHousing ? input.maxRent : 0),
    transportation: travel,
    moving,
    additional: supplies + pet,
    remaining: input.budget - base,
  };
}

export const demoAlone: RelocationInput = {
  scenario: "alone",
  origin: "Boston, MA",
  destination: "New York, NY",
  movingDate: "2026-11-15",
  flexible: true,
  budget: 3000,
  adults: 1,
  children: 0,
  pets: 0,
  bedrooms: 1,
  suitcases: 2,
  furniture: false,
  transport: "compare",
  needsHousing: true,
  maxRent: 2600,
  minBedrooms: 1,
  petFriendly: false,
  neighborhood: "",
};
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
