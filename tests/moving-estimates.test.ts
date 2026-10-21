import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const parse = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import { estimateMovingExpenses } from "@/lib/intake/estimate-expenses";
import { calculateBudget, demoFamily } from "@/lib/relocation";

const amounts = {
  monthlyRent: 1700,
  transportation: 300,
  moving: 950,
  temporaryAccommodation: 400,
  additional: 625,
  housingFees: 0,
  includeSecurityDeposit: true,
};
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "fixture");
  parse.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("initial GPT expense estimates", () => {
  it("uses structured output, minimizes sent context, and labels the source", async () => {
    parse.mockResolvedValue({ output_parsed: amounts });
    const estimates = await estimateMovingExpenses(demoFamily);
    expect(estimates).toEqual({ ...amounts, source: "model" });
    expect(parse.mock.calls[0][0]).toMatchObject({
      store: false,
      text: { format: { type: "json_schema" } },
    });
    expect(JSON.parse(parse.mock.calls[0][0].input)).not.toHaveProperty(
      "planningContext",
    );
    expect(
      calculateBudget({ ...demoFamily, expenseEstimates: estimates })
        .recommended,
    ).toBe(5675);
  });
  it("enforces housing and furniture requirements on model suggestions", async () => {
    parse.mockResolvedValue({ output_parsed: amounts });
    const estimates = await estimateMovingExpenses({
      ...demoFamily,
      needsHousing: false,
      furniture: false,
    });
    expect(estimates).toMatchObject({
      monthlyRent: 0,
      housingFees: 0,
      moving: 0,
      includeSecurityDeposit: false,
    });
    const budget = calculateBudget({
      ...demoFamily,
      needsHousing: false,
      furniture: false,
      expenseEstimates: estimates,
    });
    expect(budget.housingUpfront).toBe(0);
    expect(budget.moving).toBe(0);
    expect(budget.recommended).toBe(1325);
  });
  it("falls back without a key, on errors, refusals, or invalid amounts", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await estimateMovingExpenses(demoFamily)).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
    vi.stubEnv("OPENAI_API_KEY", "fixture");
    parse.mockRejectedValueOnce(new Error("unavailable"));
    expect(await estimateMovingExpenses(demoFamily)).toBeUndefined();
    parse.mockResolvedValueOnce({ output_parsed: null });
    expect(await estimateMovingExpenses(demoFamily)).toBeUndefined();
    parse.mockResolvedValueOnce({
      output_parsed: { ...amounts, transportation: -5 },
    });
    expect(await estimateMovingExpenses(demoFamily)).toBeUndefined();
    parse.mockResolvedValueOnce({ output_parsed: {} });
    expect(await estimateMovingExpenses(demoFamily)).toBeUndefined();
  });
});
