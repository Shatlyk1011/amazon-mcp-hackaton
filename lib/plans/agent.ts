import "server-only";
import OpenAI from "openai";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  getPlan,
  listRequests,
  startRequest,
  finishRequest,
  withPlanLock,
  checkRequestLimit,
} from "./repository";
import { PlanError } from "./errors";
import { SESSION_COOKIE } from "./session";
import { runAgentLoop } from "./agent-loop";
import type { PlanRequest } from "./types";

export async function handlePlanMessage(
  id: string,
  owner: string,
  sessionToken: string,
  message: string,
  requestId: string,
) {
  if (!process.env.OPENAI_API_KEY)
    throw new PlanError(
      "OpenAI is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL)
    throw new PlanError(
      "Set APP_URL to the application origin before using OpenAI.",
      503,
    );
  const origin = new URL(process.env.APP_URL || "http://localhost:3000");
  if (!["https:", "http:"].includes(origin.protocol))
    throw new PlanError("Invalid APP_URL configuration.", 503);
  return withPlanLock(id, owner, async (operationToken) => {
    await checkRequestLimit(owner);
    const history = await listRequests(id, owner);
    await startRequest(id, requestId, message);
    const traces: PlanRequest["tools"] = [];
    const signal = AbortSignal.timeout(150_000);
    const mcp = new Client({
      name: "moveflow-openai-client",
      version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(`/api/plans/${id}/mcp`, origin),
      {
        requestInit: {
          headers: {
            cookie: `${SESSION_COOKIE}=${sessionToken}`,
            "x-moveflow-operation": operationToken,
          },
          redirect: "error",
          signal,
        },
      },
    );
    try {
      await mcp.connect(transport);
      const reply = await runAgentLoop({
        openai: new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          maxRetries: 0,
          timeout: 60_000,
        }),
        mcp,
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        history,
        message,
        traces,
        signal,
      });
      await finishRequest(id, requestId, reply, traces);
    } catch (error) {
      const reason =
        error instanceof OpenAI.APIError
          ? error.status === 401
            ? "OpenAI rejected the API key. Check OPENAI_API_KEY on the server."
            : error.status === 429
              ? "OpenAI is temporarily unavailable because of a rate or quota limit."
              : error.status === 404
                ? "The configured OpenAI model is unavailable. Check OPENAI_MODEL."
                : "OpenAI could not complete this request."
          : "The request could not be completed.";
      await finishRequest(
        id,
        requestId,
        `${reason} Any successful tool changes are already saved below. Review the plan before submitting a new request.`,
        traces,
        true,
      );
    } finally {
      await mcp.close().catch(() => {});
    }
    return {
      plan: await getPlan(id, owner),
      requests: await listRequests(id, owner),
    };
  });
}
