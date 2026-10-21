import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/providers/mapbox", () => ({ calculateMapboxRoute: vi.fn() }));
vi.mock("@/lib/providers/rentcast", () => ({ searchHousing: vi.fn() }));
vi.mock("@/lib/providers/tomtom-search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/tomtom-search")>()),
  searchMovingServices: vi.fn(),
}));
vi.mock("@/lib/providers/demo-flights", () => ({
  searchFlightConnections: vi.fn(),
}));
vi.mock("@/lib/plans/prompt", () => ({ extractRelocationDetails: vi.fn() }));
const parseEstimates = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    responses = { parse: parseEstimates };
  },
}));
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { POST } from "@/app/api/mcp/route";
import { calculateMapboxRoute } from "@/lib/providers/mapbox";
import { searchHousing } from "@/lib/providers/rentcast";
import { searchMovingServices } from "@/lib/providers/tomtom-search";
import { searchFlightConnections } from "@/lib/providers/demo-flights";
import { extractRelocationDetails } from "@/lib/plans/prompt";
import { testExpenseEstimates } from "./fixtures/estimates";
import { generatePlan } from "@/lib/plans/generate";
import { demoFamily, type Housing } from "@/lib/relocation";
import { beginIntake, completeIntake, intakeView } from "@/lib/intake/engine";
import {
  buildHousingMap,
  buildPlanMap,
  buildPlanPresentation,
  movePlanText,
} from "@/lib/intake/plan-result";
import { quizHtml, resultResourceUri } from "@/lib/intake/quiz-app";

const state = {
  ...beginIntake({ ...demoFamily, otherNeeds: "No other needs" }),
  expenseEstimates: testExpenseEstimates,
};
const fetchedAt = "2026-10-20T12:00:00Z";
const home = (id: string, rent = 2800, bedrooms = 2): Housing => ({
  id,
  title: `Home ${id}`,
  address: `${id} Example Street`,
  monthlyRent: rent,
  bedrooms,
  bathrooms: 1,
  image: "",
  availability: "Listed as available",
  listingUrl: `https://www.zillow.com/homes/${id}`,
  isDemoData: false,
  lat: 40.7,
  lng: -73.9,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "fixture");
  const { source: _source, ...amounts } = testExpenseEstimates;
  void _source;
  parseEstimates.mockResolvedValue({ output_parsed: amounts });
  vi.stubEnv("MAPBOX_ACCESS_TOKEN", "");
  vi.mocked(calculateMapboxRoute).mockResolvedValue({
    origin: demoFamily.origin,
    destination: demoFamily.destination,
    status: "live",
    source: "Mapbox",
    distanceMiles: 215,
    durationHours: 4.2,
    originCoordinates: { longitude: -71, latitude: 42 },
    destinationCoordinates: { longitude: -74, latitude: 40.7 },
    geometry: {
      type: "LineString",
      coordinates: Array.from({ length: 10_000 }, (_, i) => [
        -71 - i / 4000,
        42 - i / 10000,
      ]),
    },
  });
  vi.mocked(searchHousing).mockResolvedValue({
    listings: [
      home("match"),
      home("expensive", 9000),
      home("small", 1500, 1),
      { ...home("demo"), isDemoData: true },
    ],
    status: "live",
    source: "RentCast",
    fetchedAt,
    browseUrl: "https://www.zillow.com/",
  });
  vi.mocked(searchMovingServices).mockResolvedValue({
    movers: [
      {
        id: "mover",
        name: "Mover",
        service: "Moving",
        isDemoData: false,
        website: "javascript:alert(1)",
      },
    ],
    status: "live",
    source: "TomTom",
    fetchedAt,
  });
  vi.mocked(searchFlightConnections).mockResolvedValue({
    origin: demoFamily.origin,
    destination: demoFamily.destination,
    departureDate: demoFamily.movingDate,
    status: "fallback",
    source: "Simulated flight examples",
    fetchedAt,
    isDemoData: true,
    connections: [
      {
        id: "demo",
        stops: 0,
        segments: [
          {
            flightNumber: "DEMO 101",
            airline: "Fiction",
            originAirport: "BOS",
            destinationAirport: "JFK",
          },
        ],
      },
    ],
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function resultFixture() {
  const result = await generatePlan(completeIntake(state));
  const structuredContent = buildPlanPresentation(result, state);
  return {
    result,
    payload: {
      structuredContent,
      content: [{ type: "text", text: movePlanText(structuredContent) }],
      _meta: { moveflow: { map: await buildPlanMap(result) } },
    },
  };
}

describe("MoveFlow final result", () => {
  it("shows saved homes separately with their actual city, unknown availability, and no live readiness credit", async () => {
    const { result } = await resultFixture();
    const plan = buildPlanPresentation(
      {
        ...result,
        housingStatus: "unavailable",
        housingSource: "RentCast · saved snapshot (development data)",
        housingWarning: "Live rental search is not configured.",
        housing: [
          {
            ...home("stored"),
            city: "Houston",
            state: "TX",
            fetchedAt: "2026-10-15T12:00:00Z",
          },
        ],
      },
      state,
    );
    expect(plan.housing.totalMatches).toBe(0);
    expect(plan.housing.options).toEqual([]);
    expect(plan.housing.examples.locations).toEqual(["Houston, TX"]);
    expect(plan.housing.examples.options[0]).toMatchObject({
      availability: "Unknown",
      fetchedAt: "2026-10-15T12:00:00Z",
    });
    expect(
      plan.readiness.blockers.some(
        (blocker) => blocker.id === "housing-options",
      ),
    ).toBe(true);
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: plan },
    });
    expect(app.root.text).toContain("Saved rental examples · Houston, TX");
    expect(app.root.text).toContain(
      "not live matches for " + plan.move.destination,
    );
    expect(app.root.text).toContain("Live rental search is not configured.");
    expect(app.root.text).toContain("2026-10-15");
    expect(app.root.text).not.toContain("0 live options");
  });
  it("generates initial GPT estimates, applies edits, and preserves them on subsequent calls", async () => {
    const client = new Client({ name: "editable-plan-test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
        fetch: async (url, init) => POST(new Request(url, init)),
      }),
    );
    try {
      const estimates = {
        ...testExpenseEstimates,
        source: "model" as const,
        monthlyRent: 1700,
        transportation: 300,
        moving: 950,
        temporaryAccommodation: 400,
        additional: 625,
        housingFees: 0,
        includeSecurityDeposit: true,
      };
      const { source: _source, ...amounts } = estimates;
      void _source;
      parseEstimates.mockResolvedValue({ output_parsed: amounts });
      const initial = await client.callTool({
        name: "generate_move_plan",
        arguments: { state: { ...state, expenseEstimates: undefined } },
      });
      const first = initial.structuredContent as ReturnType<
        typeof buildPlanPresentation
      >;
      expect(first.budget).toMatchObject({
        recommended: 5675,
        estimateSource: "model",
        monthlyRent: 1700,
      });
      expect(first.move.maxRent).toBe(demoFamily.maxRent);
      expect(first.state.expenseEstimates).toEqual(estimates);
      expect(parseEstimates).toHaveBeenCalledOnce();
      const updated = await client.callTool({
        name: "update_move_plan",
        arguments: {
          state: first.state,
          changes: {
            furniture: false,
            transport: "fly",
            pets: 0,
            maxRent: 1800,
            budget: 1000,
            movingDate: "2026-12-15",
          },
          estimates: {
            source: "user",
            monthlyRent: 1600,
            housingFees: 50,
            transportation: 900,
            temporaryAccommodation: 100,
            additional: 200,
            includeSecurityDeposit: false,
          },
        },
      });
      const next = updated.structuredContent as typeof first;
      expect(next.budget).toMatchObject({
        recommended: 2850,
        remaining: -1850,
        estimateSource: "user",
        moving: 0,
        securityDeposit: 0,
      });
      expect(next.move).toMatchObject({
        transport: "fly",
        pets: 0,
        maxRent: 1800,
        furniture: false,
      });
      expect(
        next.timeline.timeline.find((task) => task.id === "move-day")?.dueDate,
      ).toBe("2026-12-15");
      expect(
        next.timeline.timeline.some((task) => task.id === "choose-mover"),
      ).toBe(false);
      expect(next.briefing.budgetStatus).toContain("1,850");
      expect(
        next.readiness.blockers.some((blocker) => blocker.id === "route"),
      ).toBe(false);
      expect(next.state.fields.petFriendly).toBe(false);
      expect(next.state.sources.transport).toBe("answer");
      expect(searchHousing).toHaveBeenLastCalledWith(
        expect.objectContaining({ maxRent: 1800, petFriendly: false }),
      );
      expect(next.housing.options).toEqual([]);
      const again = await client.callTool({
        name: "generate_move_plan",
        arguments: {
          state: next.state,
          estimates: { source: "model", transportation: 1 },
        },
      });
      expect((again.structuredContent as typeof first).budget.recommended).toBe(
        2850,
      );
      expect(parseEstimates).toHaveBeenCalledTimes(2);
      const invalid = await client.callTool({
        name: "update_move_plan",
        arguments: {
          state: next.state,
          estimates: { source: "user", transportation: -1 },
        },
      });
      expect(invalid.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
  it("projects the shared provider pipeline into a bounded, truthful presentation", async () => {
    const { result, payload } = await resultFixture();
    const plan = payload.structuredContent;
    expect(plan.housing.options.map((h) => h.id)).toEqual(["match"]);
    expect(plan.housing.excludedCount).toBe(3);
    expect(plan.movers.options[0].sourceUrl).toBeUndefined();
    expect(plan.flights?.isDemoData).toBe(true);
    expect(plan.flights?.connections[0].segments[0].flightNumber).toBe(
      "DEMO 101",
    );
    expect(payload.content[0].text).toContain("fictional demo schedules");
    expect(JSON.stringify(plan)).not.toContain("geometry");
    expect(JSON.stringify(plan)).not.toContain("traces");
    expect(JSON.stringify(plan).length).toBeLessThan(16_000);
    expect(JSON.stringify(payload._meta)).toContain("points");
    expect(result.traces.length).toBeGreaterThan(0); // website shape is unchanged
    expect(payload.content[0].text).toContain("Housing upfront");
    expect(extractRelocationDetails).not.toHaveBeenCalled();
  });
  it("discloses unconfirmed preferences and excludes misleading fallback figures", async () => {
    const { result } = await resultFixture();
    const missing = beginIntake({
      ...demoFamily,
      bedrooms: undefined,
      minBedrooms: undefined,
      pets: undefined,
      petFriendly: undefined,
    });
    const input = completeIntake({
      ...missing,
      expenseEstimates: testExpenseEstimates,
    });
    const plan = buildPlanPresentation(
      {
        ...result,
        input,
        route: {
          origin: input.origin,
          destination: input.destination,
          status: "fallback",
          source: "Demo",
          distanceMiles: 215,
          durationHours: 4.2,
        },
        housingStatus: "unavailable",
        movingServicesSource: "TomTom Search API · development response",
      },
      missing,
    );
    expect(plan.assumptions.join(" ")).toContain(
      "Bedroom preference was not confirmed",
    );
    expect(plan.assumptions.join(" ")).toContain("No pets");
    expect(plan.route).not.toHaveProperty("distanceMiles");
    expect(plan.housing.options).toEqual([]);
    expect(plan.movers.options).toEqual([]);
    expect(plan.movers.status).toBe("unavailable");
  });
  it("omits flights when only driving was requested", async () => {
    const { result } = await resultFixture();
    const plan = buildPlanPresentation(
      { ...result, flightSchedules: null },
      state,
    );
    expect(plan.flights).toBeNull();
    expect(movePlanText(plan)).not.toContain("Flight examples");
  });
  it("shows flight examples without a driving warning for an airplane-only move", async () => {
    const { result } = await resultFixture();
    const plan = buildPlanPresentation(
      { ...result, input: { ...result.input, transport: "fly" }, route: null },
      state,
    );
    expect(movePlanText(plan)).toContain("DEMO 101");
    expect(movePlanText(plan)).not.toContain(
      "Live driving directions are unavailable",
    );
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: plan },
    });
    expect(app.root.text).toContain("DEMO 101");
    expect(app.root.text).not.toContain(
      "Live driving directions are unavailable",
    );
  });
  it("caps listing count and rejects unsafe source URLs", async () => {
    const { result } = await resultFixture();
    const plan = buildPlanPresentation(
      {
        ...result,
        housing: Array.from({ length: 100 }, (_, i) => ({
          ...home(String(i)),
          listingUrl: i === 0 ? "data:text/html,attack" : "https://example.com",
        })),
      },
      state,
    );
    expect(plan.housing.options).toHaveLength(8);
    expect(plan.housing.totalMatches).toBe(100);
    expect(plan.housing.options[0].sourceUrl).toBeUndefined();
  });
  it("keeps map credentials server-side, bounds routes, and handles map failures", async () => {
    const { result } = await resultFixture();
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "secret-test-token");
    const fetch = vi.fn().mockImplementation(
      async () =>
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "image/png" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const map = await buildPlanMap(result);
    expect(map.status).toBe("map");
    expect(JSON.stringify(map)).not.toContain("secret-test-token");
    expect(fetch.mock.calls[0][0].length).toBeLessThan(8_192);
    const housingMap = await buildHousingMap(result);
    expect(housingMap?.status).toBe("map");
    expect(fetch.mock.calls[1][0]).toContain("pin-s-1");
    expect(fetch.mock.calls[1][0]).not.toContain("pin-s-2");
    fetch.mockRejectedValue(new Error("offline"));
    const fallback = await buildPlanMap(result);
    expect(fallback.status).toBe("diagram");
    expect("points" in fallback && fallback.points.length).toBeLessThanOrEqual(
      200,
    );
    expect((await buildHousingMap(result))?.status).toBe("unavailable");
  });
  it("registers direct result UI and returns model text separately from widget data with no extra LLM", async () => {
    const client = new Client({ name: "result-test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
        fetch: async (url, init) => POST(new Request(url, init)),
      }),
    );
    try {
      const tools = await client.listTools();
      expect(
        tools.tools.find((t) => t.name === "generate_move_plan")?._meta?.ui,
      ).toMatchObject({ resourceUri: resultResourceUri });
      const resource = await client.readResource({ uri: resultResourceUri });
      expect(resource.contents[0]).toHaveProperty(
        "text",
        expect.stringContaining("renderPlan"),
      );
      const result = await client.callTool({
        name: "generate_move_plan",
        arguments: { state },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ status: "ready" });
      expect(result.structuredContent).not.toHaveProperty("result");
      expect(result._meta).toHaveProperty("moveflow.map");
      expect((result.content as { text: string }[])[0].text).toContain(
        "MoveFlow moving plan",
      );
      expect(extractRelocationDetails).not.toHaveBeenCalled();
      vi.mocked(calculateMapboxRoute).mockRejectedValueOnce(
        new Error("provider failure"),
      );
      const error = await client.callTool({
        name: "generate_move_plan",
        arguments: { state },
      });
      expect(error.isError).toBe(true);
      expect((error.content as { text: string }[])[0].text).toContain("retry");
    } finally {
      await client.close();
    }
  });
});

// Minimal DOM harness executes the shipped iframe script, not a copy of its flow.
class TestNode {
  children: TestNode[] = [];
  textContent = "";
  className = "";
  disabled = false;
  value = "";
  checked = false;
  id = "";
  oninput?: () => void;
  onchange?: () => void;
  onclick?: () => Promise<void>;
  onsubmit?: (event: { preventDefault: () => void }) => Promise<void>;
  attributes: Record<string, string> = {};
  constructor(public tag = "div") {}
  append(...nodes: TestNode[]) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: TestNode[]) {
    this.children = nodes;
  }
  setAttribute(key: string, value: string) {
    this.attributes[key] = value;
  }
  addEventListener() {}
  remove() {}
  querySelector(selector: string): TestNode | null {
    return (
      this.children.find((n) =>
        selector.startsWith(".")
          ? n.className.split(" ").includes(selector.slice(1))
          : selector.startsWith("#")
            ? n.id === selector.slice(1)
            : n.tag === selector,
      ) ??
      this.children.map((n) => n.querySelector(selector)).find(Boolean) ??
      null
    );
  }
  get text(): string {
    return this.textContent + this.children.map((n) => n.text).join(" ");
  }
}
function appHarness() {
  const root = new TestNode();
  let height = 600;
  let resizeObserver: () => void;
  const messages: {
    id: number;
    method: string;
    params: Record<string, unknown>;
  }[] = [];
  const parent = {
    postMessage: (message: (typeof messages)[number]) => messages.push(message),
  };
  let listener: (event: unknown) => void;
  runInNewContext(quizHtml.match(/<script>([\s\S]*)<\/script>/)![1], {
    document: {
      getElementById: () => root,
      body: { getBoundingClientRect: () => ({ height }) },
      createElement: (tag: string) => new TestNode(tag),
      createElementNS: (_ns: string, tag: string) => new TestNode(tag),
    },
    Node: TestNode,
    URL,
    parent,
    setTimeout: () => 1,
    clearTimeout: () => {},
    ResizeObserver: class {
      constructor(callback: () => void) {
        resizeObserver = callback;
      }
      observe() {}
    },
    window: {
      addEventListener: (type: string, handler: typeof listener) => {
        if (type === "message") listener = handler;
      },
    },
  });
  const send = (data: unknown) => listener({ source: parent, data });
  send({ jsonrpc: "2.0", id: messages[0].id, result: {} });
  return {
    root,
    messages,
    send,
    resize: (nextHeight: number) => {
      height = nextHeight;
      resizeObserver();
    },
  };
}

describe("shipped app bridge", () => {
  it("updates the embedded plan and future model context without posting into chat", async () => {
    const { payload } = await resultFixture();
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: payload,
    });
    const travel = app.root.querySelector("#cost-transportation")!;
    travel.value = "1234";
    travel.oninput!();
    app.root.querySelector("#preference-transport")!.value = "fly";
    const submitting = app.root.querySelector("form")!.onsubmit!({
      preventDefault() {},
    });
    const call = app.messages.find((m) => m.method === "tools/call")!;
    expect(call.params).toMatchObject({
      name: "update_move_plan",
      arguments: {
        state,
        changes: { transport: "fly" },
        estimates: { source: "user", transportation: 1234 },
      },
    });
    expect(app.root.querySelector("button")!.disabled).toBe(true);
    const { arguments: args } = call.params as unknown as {
      arguments: {
        changes: Record<string, unknown>;
        estimates: NonNullable<typeof state.expenseEstimates>;
      };
    };
    const latestState = {
      ...state,
      fields: { ...state.fields, ...args.changes },
      expenseEstimates: args.estimates,
    };
    const result = await generatePlan(completeIntake(latestState));
    const plan = buildPlanPresentation(result, latestState);
    app.send({
      jsonrpc: "2.0",
      id: call.id,
      result: { ...payload, structuredContent: plan },
    });
    await submitting;
    expect(app.messages.some((m) => m.method === "ui/message")).toBe(false);
    const context = app.messages.find(
      (m) => m.method === "ui/update-model-context",
    )!;
    expect(JSON.stringify(context.params)).toContain("1234");
    expect(app.root.querySelector("#cost-transportation")!.value).toBe("1234");
    expect(app.root.text).toContain("Plan updated ·");
    expect(app.root.text).toContain(
      plan.budget.recommended.toLocaleString("en-US"),
    );
    // Unsupported context sync does not undo a successful update.
    app.send({
      jsonrpc: "2.0",
      id: context.id,
      error: { message: "Method not supported" },
    });
    await Promise.resolve();
    expect(app.root.querySelector("button")!.disabled).toBe(false);
  });
  it("keeps edits on tool failure and can retry without rebuilding the form", async () => {
    const { payload } = await resultFixture();
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: payload,
    });
    const form = app.root.querySelector("form")!;
    const amount = app.root.querySelector("#cost-additional")!;
    amount.value = "987";
    const submitting = form.onsubmit!({ preventDefault() {} });
    const call = app.messages.find((m) => m.method === "tools/call")!;
    app.send({
      jsonrpc: "2.0",
      id: call.id,
      result: { isError: true, content: [{ text: "Provider unavailable" }] },
    });
    await submitting;
    expect(amount.value).toBe("987");
    expect(app.root.querySelector("button")!.disabled).toBe(false);
    expect(app.root.text).toContain("Your edits are still here");
    expect(app.messages.some((m) => m.method === "ui/message")).toBe(false);
  });
  it("reports content growth and shrinkage without resize feedback loops", () => {
    const app = appHarness();
    app.resize(600);
    app.resize(600);
    app.resize(900);
    app.resize(400);
    expect(
      app.messages
        .filter((m) => m.method === "ui/notifications/size-changed")
        .map((m) => m.params.height),
    ).toEqual([600, 900, 400]);
  });
  it("builds in the widget and renders the same result as direct tool calls", async () => {
    const { payload } = await resultFixture();
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: intakeView(state) },
    });
    const building = app.root.querySelector("button")!.onclick!();
    const request = app.messages.find((m) => m.method === "tools/call")!;
    expect(request.params).toMatchObject({
      name: "generate_move_plan",
      arguments: { state },
    });
    app.send({ jsonrpc: "2.0", id: request.id, result: payload });
    await building;
    expect(app.root.text).toContain("Homes to compare");
    expect(app.root.text).toContain("Your timeline");
    expect(app.root.text).toContain("Flight options");
    expect(app.root.text).toContain("DEMO 101");
    expect(app.root.text).toContain("Demo data");
    expect(app.root.text).toContain("Sources and data status");
    expect(app.messages.map((m) => m.method)).not.toContain("ui/message");
    expect(app.messages.map((m) => m.method)).not.toContain(
      "ui/update-model-context",
    );
    const direct = appHarness();
    direct.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: payload,
    });
    expect(direct.root.text).toBe(app.root.text);
  });
  it("retains the ready screen after errors and uses text nodes for provider content", async () => {
    const app = appHarness();
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: intakeView(state) },
    });
    const button = app.root.querySelector("button")!;
    const building = button.onclick!();
    const request = app.messages.find((m) => m.method === "tools/call")!;
    app.send({
      jsonrpc: "2.0",
      id: request.id,
      result: { isError: true, content: [{ text: "Provider unavailable" }] },
    });
    await building;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("Retry");
    expect(app.root.text).toContain("Provider unavailable");
    const { payload } = await resultFixture();
    payload.structuredContent.housing.options[0].title =
      '<img src=x onerror="attack()">';
    app.send({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: payload,
    });
    expect(app.root.text).toContain('<img src=x onerror="attack()">');
    expect(quizHtml).not.toContain("innerHTML");
    expect(app.root.querySelector("img")).toBeNull();
  });
});
