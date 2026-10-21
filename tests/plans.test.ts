import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type OpenAI from "openai";
import { demoFamily, calculateBudget, recommendations } from "@/lib/relocation";
import type { PlanResult, PlanRequest } from "@/lib/plans/types";
import { testExpenseEstimates } from "./fixtures/estimates";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ sql: undefined as unknown }));
vi.mock("@/lib/plans/db", () => ({ database: () => state.sql }));
vi.mock("@/lib/plans/generate", () => ({ generatePlan: vi.fn() }));

import {
  createPlan,
  getPlan,
  withPlanLock,
  savePlan,
  verifyPlanLock,
  listRequests,
  saveInitialPrompt,
  startRequest,
  finishRequest,
} from "@/lib/plans/repository";
import { regeneratePlan, updateSelection } from "@/lib/plans/service";
import { generatePlan } from "@/lib/plans/generate";
import { planMcpHandler } from "@/lib/plans/mcp";
import { runAgentLoop } from "@/lib/plans/agent-loop";
import { readJson } from "@/lib/plans/session";
import { beginIntake, answerIntake } from "@/lib/intake/engine";
import {
  createIntake,
  getIntake,
  latestIntake,
  updateIntake,
  completeSavedIntake,
  readProfile,
  writeProfile,
} from "@/lib/intake/repository";

const db = new PGlite();
function fixture(input = demoFamily): PlanResult {
  input = {
    ...input,
    expenseEstimates: { ...testExpenseEstimates, ...input.expenseEstimates },
  };
  return {
    input,
    route: {
      origin: input.origin,
      destination: input.destination,
      distanceMiles: 215,
      durationHours: 4.2,
      source: "Test",
      status: "fallback",
    },
    flightSchedules: null,
    housing: [
      {
        id: "house-1",
        title: "Example rental",
        address: "Example address",
        monthlyRent: 1700,
        bedrooms: 2,
        bathrooms: 1,
        image: "",
        availability: "Unknown",
        listingUrl: "https://example.com",
        isDemoData: true,
        lat: 40,
        lng: -74,
      },
      {
        id: "house-2",
        title: "Second example rental",
        address: "Second example address",
        monthlyRent: 1900,
        bedrooms: 2,
        bathrooms: 2,
        image: "",
        availability: "Listed as available",
        listingUrl: "https://example.com/second",
        isDemoData: true,
        lat: 41,
        lng: -73,
      },
    ],
    movers: [
      {
        id: "mover-1",
        name: "Example mover",
        service: "Moving",
        isDemoData: true,
      },
    ],
    recommendations: recommendations(input),
    budget: calculateBudget(input),
    traces: [],
    generatedAt: new Date().toISOString(),
    housingSource: "Test",
    housingStatus: "unavailable",
    housingWarning: "Fixture only",
    housingBrowseUrl: "https://example.com",
    housingFetchedAt: new Date().toISOString(),
    movingServicesSource: "Test",
    movingServicesStatus: "unavailable",
    movingServicesWarning: "Fixture only",
    movingServicesFetchedAt: new Date().toISOString(),
    selectedHousingId: null,
    selectedMoverId: null,
  };
}

beforeAll(async () => {
  await db.exec(
    await readFile(
      new URL("../db/migrations/001_saved_plans.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL("../db/migrations/002_move_intake.sql", import.meta.url),
      "utf8",
    ),
  );
  const query = async (text: string, values: unknown[]) =>
    (await db.query(text, values)).rows;
  state.sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) =>
      query(
        strings.reduce(
          (text, part, index) => text + (index ? `$${index}` : "") + part,
          "",
        ),
        values,
      ),
    { query },
  );
});
beforeEach(async () => {
  await db.exec("TRUNCATE relocation_plans CASCADE");
  await db.exec("TRUNCATE relocation_profiles, relocation_intakes");
  vi.mocked(generatePlan)
    .mockReset()
    .mockImplementation(async (input) => fixture(input));
});
afterAll(async () => {
  await db.close();
});

async function readyPlan(owner = "owner-a") {
  const plan = await createPlan(owner, randomUUID(), demoFamily);
  return withPlanLock(plan.id, owner, (token) =>
    regeneratePlan(plan.id, owner, token),
  );
}

describe("saved adaptive intake", () => {
  it("persists profiles by owner and snapshots supplied context", async () => {
    await writeProfile("owner-a", {
      adults: 2,
      pets: 1,
      workInfo: "Remote work",
    });
    expect(await readProfile("owner-b")).toEqual({});
    const state = beginIntake(
      { origin: "Boston, MA", destination: "Texas" },
      await readProfile("owner-a"),
    );
    const saved = await createIntake("owner-a", randomUUID(), state);
    await writeProfile("owner-a", { pets: 0 });
    expect((await getIntake(saved.id, "owner-a")).state.fields.pets).toBe(1);
    await expect(getIntake(saved.id, "owner-b")).rejects.toMatchObject({
      status: 404,
    });
  });
  it("resumes answers, supports back, and rejects stale writes", async () => {
    const start = await createIntake(
      "owner-a",
      randomUUID(),
      beginIntake({ origin: "Boston, MA", destination: "Texas" }),
    );
    const record = await getIntake(start.id, "owner-a");
    const next = answerIntake(record.state, {
      questionId: "destination",
      text: "Austin, TX",
    });
    await updateIntake(record, "owner-a", next);
    expect((await latestIntake("owner-a"))?.nextQuestion?.id).toBe("household");
    await expect(updateIntake(record, "owner-a", next)).rejects.toMatchObject({
      status: 409,
    });
    const current = await getIntake(start.id, "owner-a");
    const previous = await updateIntake(
      current,
      "owner-a",
      current.history.at(-1)!,
      true,
    );
    expect(previous.nextQuestion?.id).toBe("destination");
    expect(previous.canGoBack).toBe(false);
  });
  it("refuses incomplete plans before writing or calling providers", async () => {
    const saved = await createIntake(
      "owner-a",
      randomUUID(),
      beginIntake({ destination: "Texas" }),
    );
    await expect(
      completeSavedIntake(await getIntake(saved.id, "owner-a"), "owner-a"),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      (await db.query("SELECT * FROM relocation_plans")).rows,
    ).toHaveLength(0);
    expect(generatePlan).not.toHaveBeenCalled();
  });
  it("completes one durable plan with the final context and deduplicates retries", async () => {
    const state = beginIntake(
      { ...demoFamily, otherNeeds: "No additional requirements" },
      { workInfo: "Hybrid work in Manhattan" },
      "Help me move",
    );
    const saved = await createIntake("owner-a", randomUUID(), state);
    const record = await getIntake(saved.id, "owner-a");
    const first = await completeSavedIntake(record, "owner-a");
    const second = await completeSavedIntake(record, "owner-a");
    expect(second.id).toBe(first.id);
    expect(second.input.planningContext).toMatchObject({
      includedSavedContext: true,
      workInfo: "Hybrid work in Manhattan",
    });
    expect(generatePlan).toHaveBeenCalledTimes(1);
    expect(
      (await db.query("SELECT * FROM relocation_plans")).rows,
    ).toHaveLength(1);
    expect(await latestIntake("owner-a")).toBeNull();
    expect((await listRequests(first.id, "owner-a"))[0].message).toBe(
      "Help me move",
    );
  });
});

describe("saved plans with PostgreSQL", () => {
  it("deduplicates submissions and enforces ownership without returning secrets", async () => {
    const key = randomUUID();
    const plan = await createPlan("owner-a", key, demoFamily);
    expect((await createPlan("owner-a", key, demoFamily)).id).toBe(plan.id);
    expect(plan).not.toHaveProperty("owner_hash");
    expect(plan).not.toHaveProperty("lock_token");
    await expect(getPlan(plan.id, "owner-b")).rejects.toMatchObject({
      status: 404,
    });
    await expect(getPlan("bad-id", "owner-a")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("preserves initial results and revisions when requirements change", async () => {
    const plan = await readyPlan();
    await withPlanLock(plan.id, "owner-a", (token) =>
      regeneratePlan(plan.id, "owner-a", token, { maxRent: 1800 }),
    );
    const reloaded = await getPlan(plan.id, "owner-a");
    expect(reloaded.input.maxRent).toBe(1800);
    expect(reloaded.version).toBe(2);
    const revisions = await db.query<{ input: typeof demoFamily }>(
      "SELECT input FROM relocation_plan_revisions ORDER BY version",
    );
    expect(revisions.rows).toHaveLength(2);
    expect(revisions.rows[0].input.maxRent).toBe(demoFamily.maxRent);
  });

  it("serializes edits, rejects expired operations, and releases locks on errors", async () => {
    const plan = await readyPlan();
    await withPlanLock(plan.id, "owner-a", async (token) => {
      await expect(
        withPlanLock(plan.id, "owner-a", async () => null),
      ).rejects.toMatchObject({ status: 409 });
      await db.query(
        "UPDATE relocation_plans SET lock_until = now() - interval '1 second' WHERE id = $1",
        [plan.id],
      );
      await expect(
        savePlan(plan, "owner-a", token, plan.input, fixture(), "expired"),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        verifyPlanLock(plan.id, "owner-a", token),
      ).rejects.toMatchObject({ status: 409 });
    });
    await expect(
      withPlanLock(plan.id, "owner-a", async () => {
        throw new Error("failure");
      }),
    ).rejects.toThrow("failure");
    await expect(
      withPlanLock(plan.id, "owner-a", async () => "released"),
    ).resolves.toBe("released");
  });

  it("keeps the last successful plan when regeneration fails", async () => {
    const plan = await readyPlan();
    vi.mocked(generatePlan).mockRejectedValueOnce(new Error("Provider failed"));
    await expect(
      withPlanLock(plan.id, "owner-a", (token) =>
        regeneratePlan(plan.id, "owner-a", token, { budget: 99 }),
      ),
    ).rejects.toThrow();
    const reloaded = await getPlan(plan.id, "owner-a");
    expect(reloaded.input.budget).toBe(demoFamily.budget);
    expect(reloaded.version).toBe(1);
    expect(reloaded.status).toBe("ready");
  });

  it("retains a failed initial record for retry", async () => {
    const plan = await createPlan("owner-a", randomUUID(), demoFamily);
    vi.mocked(generatePlan).mockRejectedValueOnce(new Error("Provider failed"));
    await expect(
      withPlanLock(plan.id, "owner-a", (token) =>
        regeneratePlan(plan.id, "owner-a", token),
      ),
    ).rejects.toThrow();
    expect((await getPlan(plan.id, "owner-a")).status).toBe("failed");
    expect(
      (
        await withPlanLock(plan.id, "owner-a", (token) =>
          regeneratePlan(plan.id, "owner-a", token),
        )
      ).status,
    ).toBe("ready");
  });

  it("saves valid selections and refuses foreign listing IDs", async () => {
    const plan = await readyPlan();
    await withPlanLock(plan.id, "owner-a", (token) =>
      updateSelection(plan.id, "owner-a", token, { housingId: "house-1" }),
    );
    expect((await getPlan(plan.id, "owner-a")).result?.selectedHousingId).toBe(
      "house-1",
    );
    await expect(
      withPlanLock(plan.id, "owner-a", (token) =>
        updateSelection(plan.id, "owner-a", token, {
          housingId: "foreign-listing",
        }),
      ),
    ).rejects.toThrow("not in this plan");
  });

  it("stores request history once and scopes it to its plan", async () => {
    const plan = await readyPlan();
    const requestId = randomUUID();
    await startRequest(plan.id, requestId, "Explain my budget");
    await finishRequest(plan.id, requestId, "Here is the estimate.", []);
    expect((await listRequests(plan.id, "owner-a"))[0].reply).toBe(
      "Here is the estimate.",
    );
    await expect(
      startRequest(plan.id, requestId, "Repeat"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(listRequests(plan.id, "owner-b")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("stores an initial voice prompt idempotently in conversation history", async () => {
    const plan = await readyPlan();
    const requestId = randomUUID();
    await saveInitialPrompt(
      plan.id,
      requestId,
      "Move me from Boston to New York next month.",
    );
    await saveInitialPrompt(
      plan.id,
      requestId,
      "Move me from Boston to New York next month.",
    );

    const requests = await listRequests(plan.id, "owner-a");
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      id: requestId,
      status: "completed",
      message: "Move me from Boston to New York next month.",
    });
    expect(requests[0].tools[0].tool).toBe("extract_relocation_prompt");
  });
});

async function connect(id: string, token?: string) {
  const methods: string[] = [];
  const client = new Client({ name: "integration-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://localhost/api/plans/${id}/mcp`),
    {
      fetch: async (url, init) => {
        const request = new Request(url, init);
        if (request.method === "POST")
          methods.push((await request.clone().json()).method);
        // Match the Next.js route: fresh handler per HTTP request, including initialization.
        return planMcpHandler(id, "owner-a", token)(request);
      },
    },
  );
  await client.connect(transport);
  return { client, methods };
}

describe("OpenAI function calling through real MCP transport", () => {
  it("calls each planning insight tool independently without changing the plan", async () => {
    const plan = await readyPlan();
    const calls = [
      {
        name: "build_move_timeline",
        arguments: { referenceDate: "2026-10-18" },
      },
      { name: "assess_move_readiness", arguments: {} },
      { name: "compare_housing_options", arguments: {} },
      {
        name: "find_destination_essentials",
        arguments: { categories: ["grocery", "pharmacy"] },
      },
      {
        name: "create_move_briefing",
        arguments: { referenceDate: "2026-10-18" },
      },
    ];

    for (const call of calls) {
      const { client } = await connect(plan.id);
      try {
        const result = await client.callTool(call);
        expect(result.isError, call.name).not.toBe(true);
      } finally {
        await client.close();
      }
    }
    expect((await getPlan(plan.id, "owner-a")).version).toBe(1);
  });

  it("retains successful tool changes when the following model response fails", async () => {
    const plan = await readyPlan();
    await withPlanLock(plan.id, "owner-a", async (token) => {
      const { client } = await connect(plan.id, token);
      try {
        const create = vi
          .fn()
          .mockResolvedValueOnce({
            status: "completed",
            output_text: "",
            output: [
              {
                type: "function_call",
                call_id: "call-change",
                name: "update_move_requirements",
                arguments: '{"changes":{"maxRent":1700}}',
              },
            ],
          })
          .mockRejectedValueOnce(new Error("Model unavailable"));
        const traces: PlanRequest["tools"] = [];
        await expect(
          runAgentLoop({
            openai: { responses: { create } } as unknown as Pick<
              OpenAI,
              "responses"
            >,
            mcp: client,
            model: "test",
            message: "Set my monthly rent limit to 1700",
            history: [],
            traces,
            signal: AbortSignal.timeout(10_000),
          }),
        ).rejects.toThrow("Model unavailable");
        expect((await getPlan(plan.id, "owner-a")).input.maxRent).toBe(1700);
        expect(traces.at(-1)?.status).toBe("completed");
        expect(create).toHaveBeenCalledTimes(2);
      } finally {
        await client.close();
      }
    });
  });

  it("does not dispatch model-invented tools to MCP", async () => {
    const plan = await readyPlan();
    const { client, methods } = await connect(plan.id);
    try {
      const create = vi
        .fn()
        .mockResolvedValueOnce({
          status: "completed",
          output_text: "",
          output: [
            {
              type: "function_call",
              call_id: "call-forbidden",
              name: "delete_database",
              arguments: "{}",
            },
          ],
        })
        .mockResolvedValueOnce({
          status: "completed",
          output_text: "That action is unavailable.",
          output: [],
        });
      await runAgentLoop({
        openai: { responses: { create } } as unknown as Pick<
          OpenAI,
          "responses"
        >,
        mcp: client,
        model: "test",
        message: "Delete everything",
        history: [],
        traces: [],
        signal: AbortSignal.timeout(10_000),
      });
      expect(methods.filter((method) => method === "tools/call")).toHaveLength(
        1,
      );
      expect((await getPlan(plan.id, "owner-a")).version).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("discovers tools, executes a model-selected change and persists it under the same ID", async () => {
    const plan = await readyPlan();
    const other = await readyPlan("owner-b");
    await withPlanLock(plan.id, "owner-a", async (token) => {
      const { client, methods } = await connect(plan.id, token);
      try {
        const create = vi
          .fn()
          .mockResolvedValueOnce({
            status: "completed",
            output_text: "",
            output: [
              {
                type: "function_call",
                call_id: "call-1",
                name: "update_move_requirements",
                arguments: '{"changes":{"maxRent":1800}}',
              },
            ],
          })
          .mockResolvedValueOnce({
            status: "completed",
            output_text: "Your monthly rent limit is now $1,800.",
            output: [],
          });
        const traces: PlanRequest["tools"] = [];
        const reply = await runAgentLoop({
          openai: { responses: { create } } as unknown as Pick<
            OpenAI,
            "responses"
          >,
          mcp: client,
          model: "test-model",
          message: "Lower my monthly rent limit to 1800",
          history: [],
          traces,
          signal: AbortSignal.timeout(10_000),
        });
        expect(reply).toContain("$1,800");
        expect((await getPlan(plan.id, "owner-a")).input.maxRent).toBe(1800);
        expect((await getPlan(other.id, "owner-b")).input.maxRent).toBe(
          demoFamily.maxRent,
        );
        expect(methods).toEqual(
          expect.arrayContaining(["initialize", "tools/list", "tools/call"]),
        );
        expect(traces.map((trace) => trace.tool)).toEqual([
          "get_move_context",
          "update_move_requirements",
        ]);
        const last = create.mock.calls[1][0];
        expect(last.store).toBe(false);
        expect(last.input).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "function_call_output",
              call_id: "call-1",
            }),
          ]),
        );
      } finally {
        await client.close();
      }
    });
  });

  it("answers a read-only question without creating a revision", async () => {
    const plan = await readyPlan();
    const { client } = await connect(plan.id);
    try {
      const create = vi.fn().mockResolvedValue({
        status: "completed",
        output_text: "Your budget includes moving and housing estimates.",
        output: [],
      });
      await runAgentLoop({
        openai: { responses: { create } } as unknown as Pick<
          OpenAI,
          "responses"
        >,
        mcp: client,
        model: "test",
        message: "Explain the budget",
        history: [],
        traces: [],
        signal: AbortSignal.timeout(10_000),
      });
      expect((await getPlan(plan.id, "owner-a")).version).toBe(1);
    } finally {
      await client.close();
    }
  });

  it("rejects invalid tool inputs and leaves saved data intact", async () => {
    const plan = await readyPlan();
    const { client } = await connect(plan.id);
    try {
      const result = await client.callTool({
        name: "update_move_requirements",
        arguments: { changes: { maxRent: -100 } },
      });
      expect(result.isError).toBe(true);
      expect((await getPlan(plan.id, "owner-a")).version).toBe(1);
    } finally {
      await client.close();
    }
  });
});

it("rejects cross-origin writes and oversized input", async () => {
  await expect(
    readJson(
      new Request("http://localhost/api/plans", {
        method: "POST",
        headers: {
          origin: "https://foreign.example",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    readJson(
      new Request("http://localhost/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "a".repeat(33_000) }),
      }),
    ),
  ).rejects.toMatchObject({ status: 413 });
});
