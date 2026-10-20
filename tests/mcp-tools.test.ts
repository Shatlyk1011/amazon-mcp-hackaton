import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
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

const standaloneCalls: {
  name: string;
  arguments: Record<string, unknown>;
}[] = [
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
  it("returns the same missing question as UI logic and gates generation on the server", async () => {
    const client = await connectPublic();
    try {
      const known = { origin: "New York, NY", destination: "Texas" };
      const prepared = await client.callTool({
        name: "prepare_move_intake",
        arguments: { known, savedContext: { pets: 2 }, includeContext: false },
      });
      const view = JSON.parse(
        (prepared.content as { type: string; text: string }[])[0].text,
      );
      expect(view.nextQuestion.id).toBe(
        intakeView(beginIntake(known)).nextQuestion?.id,
      );
      expect(view.state.fields.pets).toBeUndefined();
      const generated = await client.callTool({
        name: "generate_move_plan",
        arguments: { state: view.state },
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
  it("exposes the quiz resource and keeps text and structured intake results in sync", async () => {
    const client = await connectPublic();
    try {
      const tools = await client.listTools();
      const prepare = tools.tools.find(
        (tool) => tool.name === "prepare_move_intake",
      );
      expect(prepare?._meta?.ui).toEqual({
        resourceUri: "ui://moveflow/quiz.html",
      });
      const resource = await client.readResource({
        uri: "ui://moveflow/quiz.html",
      });
      expect(resource.contents[0]).toMatchObject({
        mimeType: "text/html;profile=mcp-app",
      });
      expect(resource.contents[0]).toHaveProperty(
        "text",
        expect.stringContaining("answer_move_intake"),
      );
      const result = await client.callTool({
        name: "prepare_move_intake",
        arguments: { known: { origin: "Boston, MA" } },
      });
      expect(result.structuredContent).toEqual(
        JSON.parse((result.content as { text: string }[])[0].text),
      );
      expect(
        (result.structuredContent as { nextQuestion: { id: string } })
          .nextQuestion.id,
      ).toBe("destination");
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

  it("returns explicitly simulated flight examples through MCP without an API key", async () => {
    const client = await connectPublic();
    try {
      const result = await client.callTool({
        name: "suggest_flight_connections",
        arguments: {
          origin: "Boston, MA",
          destination: "Austin, TX",
          departureDate: "2026-11-10",
          maxStops: 0,
        },
      });
      const content = result.content as { type: string; text: string }[];
      const data = JSON.parse(content[0]!.text);
      expect(data.status).toBe("fallback");
      expect(data.isDemoData).toBe(true);
      expect(data.connections).toHaveLength(1);
      expect(data.warning).toContain("fictional");
    } finally {
      await client.close();
    }
  });

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
