import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { database } from "./db";
import { PlanError } from "./errors";
import type { PlanResult, SavedPlan, PlanRequest } from "./types";
import type { RelocationInput } from "@/lib/relocation";

// Selected columns deliberately exclude the session hash and operation token.
const selectColumns = `id, input, result, status, error, version, created_at AS "createdAt", updated_at AS "updatedAt"`;

export async function getPlan(id: string, owner: string): Promise<SavedPlan> {
  if (!z.uuid().safeParse(id).success)
    throw new PlanError("Plan not found.", 404);
  const rows = await database().query(
    `SELECT ${selectColumns} FROM relocation_plans WHERE id = $1 AND owner_hash = $2`,
    [id, owner],
  );
  if (!rows[0]) throw new PlanError("Plan not found.", 404);
  const plan = rows[0] as SavedPlan;
  if (!plan.result) return plan;
  // Older saved plans may contain fictional flight schedules and traces.
  const result = { ...plan.result } as PlanResult & {
    flightSchedules?: unknown;
  };
  delete result.flightSchedules;
  result.traces = result.traces.filter(
    (trace) => trace.tool !== "suggest_flight_connections",
  );
  return { ...plan, result };
}

export async function createPlan(
  owner: string,
  key: string,
  input: RelocationInput,
) {
  const sql = database();
  const rows =
    await sql`INSERT INTO relocation_plans (id, owner_hash, creation_key, input)
    VALUES (${randomUUID()}, ${owner}, ${key}, ${JSON.stringify(input)}::jsonb)
    ON CONFLICT (owner_hash, creation_key) DO UPDATE SET creation_key = EXCLUDED.creation_key RETURNING id`;
  return getPlan(rows[0].id, owner);
}

export async function withPlanLock<T>(
  id: string,
  owner: string,
  work: (token: string) => Promise<T>,
): Promise<T> {
  await getPlan(id, owner);
  const sql = database();
  const token = randomUUID();
  const rows =
    await sql`UPDATE relocation_plans SET lock_token = ${token}, lock_until = now() + interval '5 minutes'
    WHERE id = ${id} AND owner_hash = ${owner} AND (lock_until IS NULL OR lock_until < now()) RETURNING id`;
  if (!rows.length)
    throw new PlanError(
      "Another request is updating this plan. Please wait and try again.",
      409,
    );
  try {
    await sql`UPDATE relocation_requests SET status = 'failed', reply = 'The previous request was interrupted. Review the saved plan before trying again.'
      WHERE plan_id = ${id} AND status = 'running' AND created_at < now() - interval '5 minutes'`;
    return await work(token);
  } finally {
    await sql`UPDATE relocation_plans SET lock_token = NULL, lock_until = NULL WHERE id = ${id} AND owner_hash = ${owner} AND lock_token = ${token}`;
  }
}

export async function verifyPlanLock(id: string, owner: string, token: string) {
  if (!z.uuid().safeParse(token).success)
    throw new PlanError("Invalid operation.", 403);
  const rows =
    await database()`SELECT id FROM relocation_plans WHERE id = ${id} AND owner_hash = ${owner} AND lock_token = ${token} AND lock_until > now()`;
  if (!rows.length)
    throw new PlanError("This operation has expired. Please retry.", 409);
}

export async function savePlan(
  plan: SavedPlan,
  owner: string,
  token: string,
  input: RelocationInput,
  result: PlanResult,
  reason: string,
) {
  const rows = await database()`WITH updated AS (
    UPDATE relocation_plans SET input = ${JSON.stringify(input)}::jsonb, result = ${JSON.stringify(result)}::jsonb,
      status = 'ready', error = NULL, version = version + 1, updated_at = now()
    WHERE id = ${plan.id} AND owner_hash = ${owner} AND version = ${plan.version} AND lock_token = ${token} AND lock_until > now()
    RETURNING id, version, input, result
  ) INSERT INTO relocation_plan_revisions (plan_id, version, input, result, reason)
    SELECT id, version, input, result, ${reason} FROM updated RETURNING plan_id`;
  if (!rows.length)
    throw new PlanError(
      "The plan changed or the request expired. Reload and try again.",
      409,
    );
  return getPlan(plan.id, owner);
}

export async function markGenerationFailed(
  id: string,
  owner: string,
  token: string,
) {
  await database()`UPDATE relocation_plans SET status = 'failed', error = 'Could not generate the plan. Please retry.', updated_at = now()
    WHERE id = ${id} AND owner_hash = ${owner} AND lock_token = ${token} AND result IS NULL`;
}

export async function listRequests(
  id: string,
  owner: string,
): Promise<PlanRequest[]> {
  await getPlan(id, owner);
  const rows =
    await database()`SELECT id, message, reply, status, tools, created_at AS "createdAt"
    FROM (SELECT * FROM relocation_requests WHERE plan_id = ${id} ORDER BY created_at DESC LIMIT 30) recent ORDER BY created_at`;
  return (rows as PlanRequest[]).map((request) => ({
    ...request,
    tools: request.tools.filter(
      (tool) => tool.tool !== "suggest_flight_connections",
    ),
  }));
}

export async function startRequest(
  id: string,
  requestId: string,
  message: string,
) {
  const rows =
    await database()`INSERT INTO relocation_requests (id, plan_id, message) VALUES (${requestId}, ${id}, ${message})
    ON CONFLICT (id) DO NOTHING RETURNING id`;
  if (!rows.length)
    throw new PlanError(
      "This request was already submitted. Reload to see its result.",
      409,
    );
}

export async function checkRequestLimit(owner: string) {
  const rows =
    await database()`SELECT count(*)::int AS total FROM relocation_requests r
    JOIN relocation_plans p ON p.id = r.plan_id WHERE p.owner_hash = ${owner} AND r.created_at > now() - interval '1 hour'`;
  if (rows[0].total >= 30)
    throw new PlanError(
      "You have reached 30 requests this hour. Please try again later.",
      429,
    );
}

export async function finishRequest(
  id: string,
  requestId: string,
  reply: string,
  tools: PlanRequest["tools"],
  failed = false,
) {
  await database()`UPDATE relocation_requests SET reply = ${reply}, tools = ${JSON.stringify(tools)}::jsonb,
    status = ${failed ? "failed" : "completed"} WHERE id = ${requestId} AND plan_id = ${id}`;
}

export async function saveInitialPrompt(
  id: string,
  requestId: string,
  message: string,
) {
  const tools = [
    {
      tool: "extract_relocation_prompt",
      status: "completed",
      duration: 0,
      output: { savedToPlan: true },
    },
  ];
  await database()`INSERT INTO relocation_requests (id, plan_id, message, reply, status, tools)
    VALUES (${requestId}, ${id}, ${message}, ${"I created the plan from this request. You can keep refining it here."}, 'completed', ${JSON.stringify(tools)}::jsonb)
    ON CONFLICT (id) DO NOTHING`;
}
