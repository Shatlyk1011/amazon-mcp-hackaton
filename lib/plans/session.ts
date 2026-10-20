import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { PlanError } from "./errors";

export const SESSION_COOKIE = "moveflow_session";
export function hashSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getSession(create = false) {
  const jar = await cookies();
  let token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) throw new PlanError("Plan not found.", 404);
    token = randomBytes(32).toString("hex");
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return { token, owner: hashSession(token) };
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (origin && origin !== expected)
    throw new PlanError("This request origin is not allowed.", 403);
}

export async function readJson(request: Request) {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new PlanError("Expected JSON.", 415);
  const body = await request.text();
  if (body.length > 32_000) throw new PlanError("Request is too large.", 413);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new PlanError("Invalid JSON.", 400);
  }
}
