import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("openai", async () => {
  const { testExpenseEstimates } = await import("./fixtures/estimates");
  const { source: _source, ...amounts } = testExpenseEstimates;
  void _source;
  return {
    default: class {
      responses = { parse: async () => ({ output_parsed: amounts }) };
    },
  };
});
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { POST as publicMcpHandler } from "@/app/api/mcp/route";
import { demoFamily } from "@/lib/relocation";
import { beginIntake, intakeView } from "@/lib/intake/engine";
const fullState = beginIntake(
  { ...demoFamily, otherNeeds: "No additional requirements" },
  {},
  "",
  new Date("2026-10-18T12:00:00Z"),
);

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "fixture"));

function fixtureHousing(id: string, monthlyRent: number) {
  return {
    id,
    title: `Rental ${id}`,
    address: `${id} Example Street`,
    monthlyRent,
    bedrooms: 2,
    bathrooms: 1,
    availability: "Listed as available" as const,
  };
}

async function connectPublic() {
  const client = new Client({ name: "standalone-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/api/mcp"),
    {
      fetch: async (url, init) => publicMcpHandler(new Request(url, init)),
    },
  );
  await client.connect(transport);
  return client;
}

describe("relocation tool discovery metadata", () => {
  it("validates confirmed-answer edits and preserves the rest of the caller-owned state", async () => {
    const client = await connectPublic();
    try {
      const initial = beginIntake({
        origin: "Boston, MA",
        destination: "Austin, TX",
        adults: 2,
      });
      const result = await client.callTool({
        name: "answer_move_intake",
        arguments: {
          state: initial,
          changes: { origin: "Seattle, WA" },
          interactionMode: "widget",
        },
      });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        state: {
          fields: {
            origin: "Seattle, WA",
            destination: "Austin, TX",
            adults: 2,
          },
          sources: { origin: "answer" },
        },
      });
      expect(result._meta).toHaveProperty("moveflow.view.nextQuestion");
      const invalid = await client.callTool({
        name: "answer_move_intake",
        arguments: {
          state: initial,
          changes: { adults: -1 },
          interactionMode: "widget",
        },
      });
      expect(invalid.isError).toBe(true);
      const ambiguous = await client.callTool({
        name: "answer_move_intake",
        arguments: {
          state: initial,
          changes: { adults: 3 },
          answer: { questionId: "household", text: "3" },
        },
      });
      expect(ambiguous.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
  it("describes natural relocation requests and excludes ordinary trips", async () => {
    const client = await connectPublic();
    try {
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toContain(
        "suggest_flight_connections",
      );
      const intake = tools.find((tool) => tool.name === "prepare_move_intake");
      expect(intake?.description).toContain("moving from Boston to Austin");
      expect(intake?.description).toContain("simple trip or flight search");
      expect(intake?.description).toContain("never invent");
      expect(intake?.description).toContain(
        "earlier conversation, user profile, or memory",
      );
      expect(intake?.description).toContain("set includeContext to true");
    } finally {
      await client.close();
    }
  });
});

const standaloneCalls: {
  name: string;
  arguments: Record<string, unknown>;
}[] = [
  {
    name: "get_moveflow_view",
    arguments: {
      state: beginIntake({ origin: "New York, NY", destination: "Dallas, TX" }),
    },
  },
  {
    name: "prepare_move_intake",
    arguments: { known: { origin: "New York, NY", destination: "Texas" } },
  },
  {
    name: "answer_move_intake",
    arguments: {
      state: beginIntake({}, {}, "", new Date("2026-10-18T12:00:00Z")),
      answer: { questionId: "origin", text: "Boston, MA" },
    },
  },
  {
    name: "get_relocation_rent_guidance",
    arguments: { cities: ["Austin, TX", "Dallas, TX"], bedrooms: 2 },
  },
  { name: "generate_move_plan", arguments: { state: fullState } },
  {
    name: "update_move_plan",
    arguments: {
      state: fullState,
      changes: { transport: "fly" },
      estimates: { source: "user", transportation: 600 },
    },
  },
  { name: "draft_relocation_plan", arguments: demoFamily },
  {
    name: "calculate_route",
    arguments: {
      origin: demoFamily.origin,
      destination: demoFamily.destination,
    },
  },
  {
    name: "suggest_flight_connections",
    arguments: {
      origin: demoFamily.origin,
      destination: demoFamily.destination,
      departureDate: demoFamily.movingDate,
    },
  },
  {
    name: "search_housing",
    arguments: {
      destination: demoFamily.destination,
      maxRent: demoFamily.maxRent,
      bedrooms: demoFamily.minBedrooms,
      petFriendly: demoFamily.petFriendly,
    },
  },
  {
    name: "search_moving_services",
    arguments: {
      origin: demoFamily.origin,
      destination: demoFamily.destination,
      furniture: demoFamily.furniture,
    },
  },
  { name: "calculate_budget", arguments: demoFamily },
  {
    name: "preview_relocation_selection",
    arguments: {
      ...demoFamily,
      selection: {
        housing: { id: "provider-house", monthlyRent: 3200 },
        moverId: "provider-mover",
      },
    },
  },
  {
    name: "build_move_timeline",
    arguments: { ...demoFamily, referenceDate: "2026-10-18" },
  },
  {
    name: "assess_move_readiness",
    arguments: {
      input: demoFamily,
      routeAvailable: true,
      housingOptionsAvailable: true,
      movingServicesAvailable: true,
      selectedHousingId: null,
      selectedMoverId: null,
    },
  },
  {
    name: "compare_housing_options",
    arguments: {
      input: demoFamily,
      options: [fixtureHousing("one", 3200), fixtureHousing("two", 3600)],
    },
  },
  {
    name: "find_destination_essentials",
    arguments: {
      destination: demoFamily.destination,
      categories: ["grocery", "pharmacy"],
    },
  },
  {
    name: "create_move_briefing",
    arguments: {
      input: demoFamily,
      routeAvailable: true,
      housingOptionsAvailable: true,
      movingServicesAvailable: true,
      selectedHousingId: null,
      selectedMoverId: null,
      referenceDate: "2026-10-18",
    },
  },
];

describe("public MCP standalone contracts", () => {
  it("uses supplied user context, gives current facts precedence, and carries it into plan generation", async () => {
    const client = await connectPublic();
    try {
      const {
        adults: _adults,
        children: _children,
        pets: _pets,
        ...move
      } = demoFamily;
      void _adults;
      void _children;
      void _pets;
      const prepared = await client.callTool({
        name: "prepare_move_intake",
        arguments: {
          known: {
            ...move,
            adults: 3,
            otherNeeds: "No additional requirements",
          },
          savedContext: { adults: 2, children: 2, pets: 1 },
          includeContext: true,
          interactionMode: "conversation",
        },
      });
      const view = prepared.structuredContent as {
        ready: boolean;
        questions: { id: string }[];
        state: {
          fields: Record<string, unknown>;
          sources: Record<string, string>;
        };
      };
      expect(view.state.fields).toMatchObject({
        adults: 3,
        children: 2,
        pets: 1,
      });
      expect(view.state.sources).toMatchObject({
        adults: "request",
        children: "saved_context",
        pets: "saved_context",
      });
      expect(view.questions.map((question) => question.id)).not.toContain(
        "household",
      );
      expect(view.ready).toBe(true);
      const generated = await client.callTool({
        name: "generate_move_plan",
        arguments: { state: view.state },
      });
      expect(generated.structuredContent).toMatchObject({
        status: "ready",
        state: { fields: { adults: 3, children: 2, pets: 1 } },
      });
    } finally {
      await client.close();
    }
  });
  it("asks the user to enter unspecified locations without suggesting a default route", async () => {
    const client = await connectPublic();
    try {
      const prepared = await client.callTool({
        name: "prepare_move_intake",
        arguments: { interactionMode: "conversation" },
      });
      const view = prepared.structuredContent as {
        state: { fields: Record<string, unknown> };
        nextQuestion: { id: string; options: unknown[] };
      };
      expect(view.state.fields.origin).toBeUndefined();
      expect(view.state.fields.destination).toBeUndefined();
      expect(view.nextQuestion.id).toBe("origin");
      expect(view.nextQuestion.options).toEqual([]);
      const answered = await client.callTool({
        name: "answer_move_intake",
        arguments: {
          state: view.state,
          interactionMode: "conversation",
          answer: { questionId: "origin", text: "Boston, MA" },
        },
      });
      const next = answered.structuredContent as {
        state: { fields: Record<string, unknown> };
        nextQuestion: { id: string; options: unknown[] };
      };
      expect(next.state.fields.destination).toBeUndefined();
      expect(next.nextQuestion.id).toBe("destination");
      expect(next.nextQuestion.options).toEqual([]);
    } finally {
      await client.close();
    }
  });
  it("returns the same missing question as UI logic and gates generation on the server", async () => {
    const client = await connectPublic();
    try {
      const known = { origin: "New York, NY", destination: "Texas" };
      const prepared = await client.callTool({
        name: "prepare_move_intake",
        arguments: {
          known,
          savedContext: { pets: 2 },
          includeContext: false,
          interactionMode: "conversation",
        },
      });
      const view = prepared.structuredContent as {
        nextQuestion: { id: string };
        state: { fields: Record<string, unknown> };
      };
      expect(view.nextQuestion.id).toBe(
        intakeView(beginIntake(known)).nextQuestion?.id,
      );
      expect(view.state.fields.pets).toBeUndefined();
      const generated = await client.callTool({
        name: "generate_move_plan",
        arguments: { state: view.state, interactionMode: "conversation" },
      });
      const result = JSON.parse(
        (generated.content as { type: string; text: string }[])[0].text,
      );
      expect(result.status).toBe("needs_input");
      expect(result.nextQuestion.id).toBe("destination");
    } finally {
      await client.close();
    }
  });
  it("directs users to the quiz while retaining structured intake data", async () => {
    const client = await connectPublic();
    try {
      const tools = await client.listTools();
      const prepare = tools.tools.find(
        (tool) => tool.name === "prepare_move_intake",
      );
      expect(prepare?._meta?.ui).toEqual({
        resourceUri: "ui://moveflow/quiz-v6.html",
      });
      expect(prepare?.description).toContain("do not repeat its questions");
      const resource = await client.readResource({
        uri: "ui://moveflow/quiz-v6.html",
      });
      expect(resource.contents[0]).toMatchObject({
        mimeType: "text/html;profile=mcp-app",
      });
      expect(resource.contents[0]).toHaveProperty(
        "text",
        expect.stringContaining("answer_move_intake"),
      );
      expect(
        resource.contents[0]._meta?.["openai/widgetDescription"],
      ).toContain("interactive quiz");
      const result = await client.callTool({
        name: "prepare_move_intake",
        arguments: { known: { origin: "Boston, MA" } },
      });
      expect((result.content as { text: string }[])[0].text).toBe(
        "Complete your move details in MoveFlow.",
      );
      expect(result.structuredContent).toMatchObject({
        status: "intake_in_progress",
        interaction: { mode: "widget", owner: "moveflow" },
      });
      expect(result.structuredContent).not.toHaveProperty("nextQuestion");
      expect(result.structuredContent).not.toHaveProperty("questions");
      expect(result._meta).toHaveProperty(
        "moveflow.view.nextQuestion.id",
        "destination",
      );
      expect(prepare?._meta?.["openai/outputTemplate"]).toBe(
        "ui://moveflow/quiz-v6.html",
      );
      const recovery = tools.tools.find(
        (tool) => tool.name === "get_moveflow_view",
      );
      expect(recovery?._meta?.ui).toEqual({ visibility: ["app"] });
      for (const uri of [
        "ui://moveflow/quiz-v5.html",
        "ui://moveflow/quiz-v4.html",
        "ui://moveflow/plan-v4.html",
        "ui://moveflow/plan-v3.html",
      ]) {
        const legacyResource = await client.readResource({ uri });
        expect(legacyResource.contents[0]).toHaveProperty(
          "text",
          expect.stringContaining("get_moveflow_view"),
        );
      }
    } finally {
      await client.close();
    }
  });
  it("discovers the complete documented tool surface", async () => {
    const client = await connectPublic();
    try {
      const discovered = await client.listTools();
      expect(discovered.tools.map((tool) => tool.name).sort()).toEqual(
        standaloneCalls.map((tool) => tool.name).sort(),
      );
      for (const tool of discovered.tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeTruthy();
        expect(tool.annotations?.destructiveHint).toBe(false);
      }
    } finally {
      await client.close();
    }
  });

  it.each(standaloneCalls)(
    "calls $name with a fresh MCP client and no prior tool calls",
    async ({ name, arguments: args }) => {
      vi.stubEnv("MAPBOX_ACCESS_TOKEN", "");
      vi.stubEnv("RENTCAST_API_KEY", "");
      vi.stubEnv("TOMTOM_API_KEY", "");
      const client = await connectPublic();
      try {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).not.toBe(true);
        expect(result.content).toEqual(
          expect.arrayContaining([expect.objectContaining({ type: "text" })]),
        );
      } finally {
        await client.close();
      }
    },
  );

  it("rejects invalid standalone input through MCP validation", async () => {
    const client = await connectPublic();
    try {
      const result = await client.callTool({
        name: "compare_housing_options",
        arguments: {
          input: demoFamily,
          options: [fixtureHousing("one", 3200)],
        },
      });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });
});
