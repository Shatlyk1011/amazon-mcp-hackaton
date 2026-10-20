import { neon } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in .env.local before running db:migrate.");
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS moveflow_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const directory = new URL("../db/migrations/", import.meta.url);
for (const name of (await readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  const applied =
    await sql`SELECT name FROM moveflow_migrations WHERE name = ${name}`;
  if (applied.length) continue;
  const source = await readFile(new URL(name, directory), "utf8");
  const statements = source
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement, [])),
    sql`INSERT INTO moveflow_migrations (name) VALUES (${name})`,
  ]);
  console.log(`Applied ${name}`);
}
console.log("Database migrations complete.");
