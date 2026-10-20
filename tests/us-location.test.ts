import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { POST } from "@/app/api/mcp/route";
import { beginIntake, answerIntake } from "@/lib/intake/engine";
import { isUsLocation, US_ONLY_ERROR } from "@/lib/us-location";

describe("USA location restrictions", () => {
  it("recognizes U.S. cities and matching states, and rejects foreign locations", () => {
    expect(isUsLocation("Austin, Texas, USA")).toBe(true);
    expect(isUsLocation("Austin, Canada")).toBe(false);
    expect(isUsLocation("Paris, France")).toBe(false);
    expect(isUsLocation("Texas", true)).toBe(true);
  });

  it("rejects foreign intake answers with the specific error", () => {
    expect(() =>
      answerIntake(beginIntake(), { questionId: "origin", text: "London, UK" }),
    ).toThrow(US_ONLY_ERROR);
  });

  it("returns an MCP error before processing foreign city inputs", async () => {
    const client = new Client({ name: "location-test", version: "1" });
    await client.connect(
      new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
        fetch: async (url, init) => POST(new Request(url, init)),
      }),
    );
    for (const [name, args] of [
      [
        "calculate_route",
        { origin: "Austin, TX", destination: "Paris, France" },
      ],
      ["get_relocation_rent_guidance", { cities: ["London, UK"], bedrooms: 1 }],
      ["prepare_move_intake", { known: { origin: "Toronto, Canada" } }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain(US_ONLY_ERROR);
    }
    await client.close();
  });
});
