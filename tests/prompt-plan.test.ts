import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const parse = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: Object.assign(
    class {
      responses = { parse };
    },
    { APIError: class extends Error {} },
  ),
}));
import { extractRelocationDetails } from "@/lib/plans/prompt";
afterEach(() => vi.unstubAllEnvs());

describe("request extraction preserves unknown details", () => {
  it("keeps a broad destination and absent requirements for the interview", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture");
    parse.mockResolvedValue({
      output_parsed: {
        origin: "New York, NY",
        destination: "Texas",
        pets: null,
        budget: null,
        adults: null,
      },
    });
    const fields = await extractRelocationDetails(
      "Help me move from New York to Texas",
    );
    expect(fields).toEqual({ origin: "New York, NY", destination: "Texas" });
    expect(parse.mock.calls.at(-1)![0].store).toBe(false);
  });
  it("preserves explicit zero values and false booleans", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fixture");
    parse.mockResolvedValue({
      output_parsed: {
        pets: 0,
        children: 0,
        furniture: false,
        needsHousing: false,
      },
    });
    expect(
      await extractRelocationDetails(
        "No pets or children, no furniture, and housing already arranged.",
      ),
    ).toMatchObject({
      pets: 0,
      children: 0,
      furniture: false,
      needsHousing: false,
    });
  });
  it("reports missing OpenAI configuration without guessing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(
      extractRelocationDetails("Help me move"),
    ).rejects.toMatchObject({ status: 503 });
  });
});
