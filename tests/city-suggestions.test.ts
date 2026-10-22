import { afterEach, describe, expect, it, vi } from "vitest";

const parse = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
vi.mock("@/lib/providers/rentcast", () => ({ searchHousing: vi.fn() }));
vi.mock("@/lib/plans/prompt", () => ({ extractRelocationDetails: vi.fn() }));
import {
  getCitySuggestions,
  enrichIntake,
  prepareIntake,
} from "@/lib/intake/service";
import { extractRelocationDetails } from "@/lib/plans/prompt";
import { beginIntake, answerIntake } from "@/lib/intake/engine";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("AI city suggestions", () => {
  it("requests and validates three cities for any state", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    parse.mockResolvedValue({
      output_parsed: { cities: ["Seattle, WA", "Spokane, WA", "Tacoma, WA"] },
    });
    expect(await getCitySuggestions("Washington")).toEqual([
      "Seattle, WA",
      "Spokane, WA",
      "Tacoma, WA",
    ]);
    expect(parse.mock.calls[0][0].input).toContain("Washington");
  });
  it("uses recovered prompt states when requesting city suggestions", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    vi.mocked(extractRelocationDetails).mockResolvedValueOnce({});
    parse.mockImplementation(async ({ input }: { input: string }) => ({
      output_parsed: {
        cities: input.includes("North Dakota")
          ? ["Fargo, ND"]
          : ["Seattle, WA"],
      },
    }));
    const view = await prepareIntake("moving from north dacota to washington");
    expect(view.questions[0].options.map((option) => option.id)).toEqual([
      "Fargo, ND",
    ]);
    expect(view.questions[1].options.map((option) => option.id)).toEqual([
      "Seattle, WA",
    ]);
  });
  it.each([
    [
      { origin: "North Dakota", destination: "Washington" },
      ["origin", "destination"],
      2,
    ],
    [{ origin: "Fargo, ND", destination: "Seattle, WA" }, [], 0],
    [{ origin: "Fargo, ND", destination: "Washington" }, ["destination"], 1],
    [{ origin: "North Dakota", destination: "Seattle, WA" }, ["origin"], 1],
  ] as const)(
    "asks for cities only where a state was supplied: %o",
    async (fields, expected, calls) => {
      vi.stubEnv("OPENAI_API_KEY", "test");
      parse.mockImplementation(async ({ input }: { input: string }) => ({
        output_parsed: {
          cities: input.includes("North Dakota")
            ? ["Fargo, ND"]
            : ["Seattle, WA"],
        },
      }));
      const view = await enrichIntake(beginIntake(fields));
      expect(
        view.questions
          .filter((question) => ["origin", "destination"].includes(question.id))
          .map((question) => question.id),
      ).toEqual(expected);
      expect(view.state.fields.origin).toBe(fields.origin);
      expect(view.state.fields.destination).toBe(fields.destination);
      expect(parse).toHaveBeenCalledTimes(calls);
    },
  );
  it("discards invalid and out-of-state suggestions and keeps manual input available on failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test");
    parse.mockResolvedValueOnce({
      output_parsed: { cities: ["Seattle, WA", "Austin, TX", "Madeup, WA"] },
    });
    expect(await getCitySuggestions("WA")).toEqual(["Seattle, WA"]);
    parse.mockRejectedValueOnce(new Error("offline"));
    const state = beginIntake({
      origin: "Washington",
      destination: "Austin, TX",
    });
    const view = await enrichIntake(state);
    expect(view.nextQuestion?.options).toEqual([]);
    expect(
      answerIntake(view.state, { questionId: "origin", text: "Seattle, WA" })
        .fields.origin,
    ).toBe("Seattle, WA");
  });
});
