import "server-only";
import { neon } from "@neondatabase/serverless";
import { PlanError } from "./errors";

export function database() {
  if (!process.env.DATABASE_URL)
    throw new PlanError(
      "Neon is not configured. Set DATABASE_URL and run pnpm db:migrate.",
      503,
    );
  return neon(process.env.DATABASE_URL);
}
