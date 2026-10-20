import { groupCitiesByState } from "@mardillu/us-cities-utils";
import { z } from "zod";

export const US_ONLY_ERROR =
  "This MCP supports USA locations only. Please provide a valid U.S. city and state.";
const states = Object.entries(groupCitiesByState()).map(([abbr, cities]) => ({
  abbr: abbr.toLowerCase(),
  name: cities[0]?.state.toLowerCase(),
  cities: new Set(cities.map((city) => city.name.toLowerCase())),
}));

export function isUsLocation(value: string, allowState = false): boolean {
  const parts = value
    .trim()
    .toLowerCase()
    .split(",")
    .map((part) => part.trim());
  if (
    parts.length > 1 &&
    /^(usa|us|u\.s\.a\.|u\.s\.|united states|united states of america)$/.test(
      parts.at(-1)!,
    )
  )
    parts.pop();
  if (parts.length > 2 || parts.some((part) => !part)) return false;
  if (parts.length === 1) {
    if (
      allowState &&
      (states.some(
        (state) => state.abbr === parts[0] || state.name === parts[0],
      ) ||
        /^(usa|us|united states|america)$/.test(parts[0]))
    )
      return true;
    return states.some((state) => state.cities.has(parts[0]));
  }
  return states.some(
    (state) =>
      (state.abbr === parts[1] || state.name === parts[1]) &&
      state.cities.has(parts[0]),
  );
}

export const usCitySchema = z
  .string()
  .trim()
  .min(2)
  .max(200)
  .refine((value) => isUsLocation(value), US_ONLY_ERROR);
export const usIntakeLocationSchema = z
  .string()
  .trim()
  .min(2)
  .max(200)
  .refine((value) => isUsLocation(value, true), US_ONLY_ERROR);
