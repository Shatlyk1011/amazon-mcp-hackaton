import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database } from "@/lib/plans/db";
import { PlanError } from "@/lib/plans/errors";
import {
  getPlan,
  saveInitialPrompt,
  withPlanLock,
} from "@/lib/plans/repository";
import { regeneratePlan } from "@/lib/plans/service";
import { completeIntake, intakeView } from "./engine";
import {
  intakeFieldsSchema,
  intakeStateSchema,
  type IntakeState,
  type SavedIntakeView,
} from "./schema";

type IntakeRecord = {
  id: string;
  state: IntakeState;
  history: IntakeState[];
  version: number;
  planId: string | null;
};
function currentRecord(record: IntakeRecord): IntakeRecord {
  return {
    ...record,
    state: {
      ...record.state,
      referenceDate: new Date().toISOString().slice(0, 10),
    },
  };
}
const columns = `id, state, history, version, plan_id AS "planId"`;

export async function readProfile(owner: string) {
  const rows =
    await database()`SELECT context FROM relocation_profiles WHERE owner_hash = ${owner}`;
  return intakeFieldsSchema.parse(rows[0]?.context ?? {});
}
export async function writeProfile(owner: string, context: unknown) {
  const fields = intakeFieldsSchema.parse(context);
  await database()`INSERT INTO relocation_profiles (owner_hash, context) VALUES (${owner}, ${JSON.stringify(fields)}::jsonb)
    ON CONFLICT (owner_hash) DO UPDATE SET context = EXCLUDED.context, updated_at = now()`;
  return fields;
}
// Older profiles stored individual fields. Keep all their values visible when
// moving to the single free-text profile, without rewriting them on read.
export function profileAsText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const profile = value as Record<string, unknown>;
  if (typeof profile.text === "string") return profile.text;
  const labels: Record<string, string> = {
    origin: "Moving from",
    destination: "Moving to",
    movingDate: "Moving date",
    flexible: "Flexible date",
    budget: "Total move budget (USD)",
    adults: "Adults",
    children: "Children",
    pets: "Pets",
    bedrooms: "Bedrooms",
    minBedrooms: "Minimum bedrooms",
    suitcases: "Suitcases",
    furniture: "Moving furniture",
    transport: "Travel preference",
    needsHousing: "Needs housing",
    maxRent: "Monthly rent limit (USD)",
    petFriendly: "Pet-friendly housing",
    neighborhood: "Neighborhood",
    workInfo: "Work and commute",
    petInfo: "Pet details",
    accessibilityNeeds: "Accessibility needs",
    otherNeeds: "Other preferences",
    scenario: "Household scenario",
  };
  return Object.entries(profile)
    .filter(
      ([, item]) =>
        item !== null &&
        item !== undefined &&
        ["string", "number", "boolean"].includes(typeof item),
    )
    .map(([key, item]) => `${labels[key] ?? key}: ${item}`)
    .join("\n");
}
export async function readProfileText(owner: string) {
  const rows =
    await database()`SELECT context FROM relocation_profiles WHERE owner_hash = ${owner}`;
  return profileAsText(rows[0]?.context);
}
export async function writeProfileText(owner: string, text: string) {
  const value = z.string().max(8000).parse(text);
  await database()`INSERT INTO relocation_profiles (owner_hash, context) VALUES (${owner}, ${JSON.stringify({ text: value })}::jsonb)
    ON CONFLICT (owner_hash) DO UPDATE SET context = EXCLUDED.context, updated_at = now()`;
  return value;
}
export function savedIntakeView(record: IntakeRecord): SavedIntakeView {
  record = currentRecord(record);
  return {
    ...intakeView(record.state),
    id: record.id,
    version: record.version,
    canGoBack: record.history.length > 0 && !record.planId,
    planId: record.planId ?? undefined,
  };
}
export async function getIntake(
  id: string,
  owner: string,
): Promise<IntakeRecord> {
  if (!z.uuid().safeParse(id).success)
    throw new PlanError("Move setup not found.", 404);
  const rows = await database().query(
    `SELECT ${columns} FROM relocation_intakes WHERE id = $1 AND owner_hash = $2`,
    [id, owner],
  );
  if (!rows[0]) throw new PlanError("Move setup not found.", 404);
  return currentRecord(rows[0] as IntakeRecord);
}
export async function latestIntake(owner: string) {
  const rows = await database().query(
    `SELECT ${columns} FROM relocation_intakes WHERE owner_hash = $1 AND plan_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [owner],
  );
  return rows[0] ? savedIntakeView(rows[0] as IntakeRecord) : null;
}
export async function createIntake(
  owner: string,
  key: string,
  state: IntakeState,
) {
  const sql = database();
  const rows =
    await sql`INSERT INTO relocation_intakes (id, owner_hash, creation_key, state)
    VALUES (${randomUUID()}, ${owner}, ${key}, ${JSON.stringify(intakeStateSchema.parse(state))}::jsonb)
    ON CONFLICT (owner_hash, creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key RETURNING id`;
  return savedIntakeView(await getIntake(rows[0].id, owner));
}
export async function updateIntake(
  record: IntakeRecord,
  owner: string,
  state: IntakeState,
  back = false,
) {
  const history = back
    ? record.history.slice(0, -1)
    : [...record.history, record.state].slice(-25);
  const rows =
    await database()`UPDATE relocation_intakes SET state = ${JSON.stringify(intakeStateSchema.parse(state))}::jsonb,
    history = ${JSON.stringify(history)}::jsonb, version = version + 1, updated_at = now()
    WHERE id = ${record.id} AND owner_hash = ${owner} AND version = ${record.version} AND plan_id IS NULL RETURNING id`;
  if (!rows.length)
    throw new PlanError(
      "This move setup changed. Reload before continuing.",
      409,
    );
  return savedIntakeView(await getIntake(record.id, owner));
}
export async function completeSavedIntake(record: IntakeRecord, owner: string) {
  record = currentRecord(record);
  let planId = record.planId;
  if (!planId) {
    const input = completeIntake(record.state);
    // Lock the matching intake revision and create/link its plan atomically.
    // Retries use the same creation key; concurrent answers cannot change the snapshot.
    const rows = await database()`WITH candidate AS (
      SELECT id FROM relocation_intakes WHERE id = ${record.id} AND owner_hash = ${owner} AND version = ${record.version} AND plan_id IS NULL FOR UPDATE
    ), inserted AS (
      INSERT INTO relocation_plans (id, owner_hash, creation_key, input)
      SELECT ${randomUUID()}::uuid, ${owner}, id, ${JSON.stringify(input)}::jsonb FROM candidate
      ON CONFLICT (owner_hash, creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key RETURNING id
    ) UPDATE relocation_intakes SET plan_id = inserted.id, version = version + 1, updated_at = now()
      FROM inserted WHERE relocation_intakes.id = ${record.id} AND owner_hash = ${owner} RETURNING inserted.id`;
    if (!rows.length) {
      const latest = await getIntake(record.id, owner);
      if (!latest.planId)
        throw new PlanError(
          "This move setup changed. Review the latest answers.",
          409,
        );
      planId = latest.planId;
    } else planId = rows[0].id;
  }
  let plan = await getPlan(planId!, owner);
  if (plan.status !== "ready") {
    try {
      plan = await withPlanLock(plan.id, owner, (token) =>
        regeneratePlan(plan.id, owner, token),
      );
    } catch {
      /* Preserve saved requirements and allow the dashboard to retry providers. */
      plan = await getPlan(plan.id, owner);
    }
  }
  if (record.state.prompt)
    await saveInitialPrompt(plan.id, record.id, record.state.prompt);
  return plan;
}
