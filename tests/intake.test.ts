import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/providers/rentcast", () => ({ searchHousing: vi.fn() }));
vi.mock("@/lib/plans/prompt", () => ({ extractRelocationDetails: vi.fn() }));
import { demoFamily, recommendations } from "@/lib/relocation";
import {
  beginIntake,
  completeIntake,
  answerIntake,
  intakeView,
  applyIntakeFields,
} from "@/lib/intake/engine";
import {
  continueIntake,
  continueIntakeBatch,
  getRentGuidance,
  prepareIntake,
} from "@/lib/intake/service";
import { searchHousing } from "@/lib/providers/rentcast";
import { extractRelocationDetails } from "@/lib/plans/prompt";
import type { IntakeFields } from "@/lib/intake/schema";
import { testExpenseEstimates } from "./fixtures/estimates";
const now = new Date("2026-10-18T12:00:00Z");
const full = { ...demoFamily, otherNeeds: "No additional requirements" };
function without(...keys: (keyof IntakeFields)[]) {
  const fields: IntakeFields = { ...full };
  for (const key of keys) delete fields[key];
  return fields;
}
beforeEach(() => vi.clearAllMocks());

describe("shared UI and MCP move intake", () => {
  it("skips optional questions and includes both travel modes", () => {
    const state = beginIntake(
      without(
        "pets",
        "petFriendly",
        "bedrooms",
        "minBedrooms",
        "transport",
        "otherNeeds",
      ),
      {},
      "",
      now,
    );
    expect(intakeView(state).ready).toBe(true);
    const input = completeIntake(state);
    expect(input).toMatchObject({
      pets: 0,
      minBedrooms: 0,
      transport: "compare",
    });
    expect(input.planningContext?.assumptions.join(" ")).toContain("No pets");
    const modes = recommendations({
      ...input,
      expenseEstimates: testExpenseEstimates,
    })
      .map((option) => option.transport)
      .join(" ");
    expect(modes).toContain("Drive");
    expect(modes).toContain("Fly");
  });
  it("leaves missing essentials unknown and refuses premature generation", () => {
    const state = beginIntake(
      { origin: "New York, NY", destination: "Texas" },
      {},
      "Move me to Texas",
      now,
    );
    expect(state.fields.pets).toBeUndefined();
    expect(state.fields.budget).toBeUndefined();
    expect(intakeView(state).nextQuestion?.id).toBe("destination");
    expect(intakeView(state).nextQuestion?.options.map((o) => o.id)).toContain(
      "Austin, TX",
    );
    expect(() => completeIntake(state)).toThrow("Which city in Texas");
    expect(() =>
      answerIntake(state, { questionId: "destination", text: "TX" }),
    ).toThrow("choose a city");
  });
  it("skips the quiz for complete requirements and keeps context in the MCP plan input", () => {
    const state = beginIntake(full, {}, "", now);
    expect(intakeView(state).ready).toBe(true);
    const input = completeIntake(state);
    expect(input).toMatchObject(demoFamily);
    expect(input.planningContext?.otherNeeds).toBe(full.otherNeeds);
  });
  it("gives explicit request facts priority over saved family and pet context", () => {
    const state = beginIntake(
      { adults: 1, children: 0, pets: 0, bedrooms: 1 },
      {
        adults: 2,
        children: 2,
        pets: 1,
        petFriendly: true,
        petInfo: "Large dog",
        minBedrooms: 3,
        workInfo: "Remote work",
      },
      "",
      now,
    );
    expect(state.fields).toMatchObject({
      adults: 1,
      children: 0,
      pets: 0,
      petFriendly: false,
      minBedrooms: 1,
      workInfo: "Remote work",
    });
    expect(state.fields.petInfo).toBeUndefined();
    expect(state.sources.adults).toBe("request");
    expect(state.sources.workInfo).toBe("saved_context");
  });
  it("uses optional income only for a rent ceiling and retains no salary", () => {
    const withoutRent = without("maxRent");
    const state = beginIntake(withoutRent, {}, "", now);
    const next = answerIntake(state, {
      questionId: "rent",
      monthlyIncome: 6000,
    });
    expect(next.fields.maxRent).toBe(1800);
    expect(next.sources.maxRent).toBe("income");
    expect(JSON.stringify(next)).not.toContain("6000");
    expect(
      completeIntake(next).planningContext?.assumptions.join(" "),
    ).toContain("30%");
  });
  it("skips rent and bedrooms when housing is already arranged", () => {
    const known = without("maxRent", "bedrooms", "minBedrooms");
    const state = beginIntake({ ...known, needsHousing: false }, {}, "", now);
    expect(intakeView(state).ready).toBe(true);
    expect(completeIntake(state)).toMatchObject({
      maxRent: 0,
      minBedrooms: 0,
      needsHousing: false,
    });
  });
  it("rejects stale questions, invented choices, and invalid custom values", () => {
    const state = beginIntake({}, {}, "", now);
    expect(() =>
      answerIntake(state, { questionId: "pets", choice: "none" }),
    ).toThrow("question has changed");
    expect(() =>
      answerIntake(state, { questionId: "origin", choice: "invented" }),
    ).toThrow("available answer");
    const withoutRent = without("maxRent");
    expect(() =>
      answerIntake(beginIntake(withoutRent, {}, "", now), {
        questionId: "rent",
        text: "-20",
      }),
    ).toThrow("positive amount");
  });
  it("interprets custom answers on the server without overwriting unrelated facts", async () => {
    vi.mocked(extractRelocationDetails).mockResolvedValue({
      adults: 2,
      children: 3,
      destination: "Wrong city",
    });
    const state = beginIntake(
      { origin: "Boston, MA", destination: "Austin, TX" },
      {},
      "",
      now,
    );
    const view = await continueIntake(state, {
      questionId: "household",
      text: "2 adults, 3 children",
    });
    expect(view.state.fields).toMatchObject({
      adults: 2,
      children: 3,
      destination: "Austin, TX",
    });
    expect(view.nextQuestion?.id).toBe("movingDate");
  });
  it("validates a collected questionnaire in sequence before one saved update", async () => {
    const view = await continueIntakeBatch(
      beginIntake(
        { origin: "Boston, MA", destination: "Austin, TX" },
        {},
        "",
        now,
      ),
      [
        { questionId: "household", choice: "solo" },
        { questionId: "movingDate", choice: "30" },
        { questionId: "housing", choice: "no" },
        { questionId: "belongings", choice: "luggage" },
        { questionId: "budget", text: "4000" },
      ],
    );
    expect(view.ready).toBe(true);
    expect(view.state.fields).toMatchObject({
      needsHousing: false,
      furniture: false,
    });
  });
  it("uses no LLM when a standalone caller provides structured context", async () => {
    const view = await prepareIntake("", full);
    expect(view.ready).toBe(true);
    expect(extractRelocationDetails).not.toHaveBeenCalled();
  });
  it("never derives local prices from demo data", async () => {
    vi.mocked(searchHousing).mockResolvedValue({
      listings: Array.from({ length: 4 }, () => ({
        monthlyRent: 1500,
        bedrooms: 2,
        isDemoData: true,
      })) as never,
      status: "unavailable",
      source: "Development response",
      fetchedAt: now.toISOString(),
      browseUrl: "https://example.com",
    });
    const guidance = await getRentGuidance("Austin, TX", 2);
    expect(guidance).toMatchObject({ status: "unavailable", sampleSize: 0 });
    expect(guidance.median).toBeUndefined();
  });
  it("sources rent choices from live matching listings and invalidates them when city changes", async () => {
    vi.mocked(searchHousing).mockResolvedValue({
      listings: [1000, 1500, 2000, 2500, 3000].map((monthlyRent) => ({
        monthlyRent,
        bedrooms: 2,
        isDemoData: false,
      })) as never,
      status: "live",
      source: "RentCast",
      fetchedAt: now.toISOString(),
      browseUrl: "https://example.com",
    });
    const rentGuidance = await getRentGuidance("Austin, TX", 2);
    expect(rentGuidance).toMatchObject({
      low: 1500,
      median: 2000,
      high: 2500,
      sampleSize: 5,
    });
    const withoutRent = without("maxRent");
    const state = {
      ...beginIntake(
        { ...withoutRent, destination: "Austin, TX" },
        {},
        "",
        now,
      ),
      rentGuidance,
    };
    const next = answerIntake(state, {
      questionId: "rent",
      choice: "market-mid",
    });
    expect(next.fields.maxRent).toBe(2000);
    expect(next.sources.maxRent).toBe("market");
    expect(
      applyIntakeFields(next, { destination: "Dallas, TX" }).rentGuidance,
    ).toBeUndefined();
  });
});
