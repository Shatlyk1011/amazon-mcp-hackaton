import type { MovingEstimates } from "@/lib/moving-estimates";

// Test-only provider output; production estimates always come from the model.
export const testExpenseEstimates: MovingEstimates = {
  source: "model",
  monthlyRent: 1700,
  transportation: 300,
  moving: 950,
  temporaryAccommodation: 400,
  additional: 625,
  housingFees: 0,
  includeSecurityDeposit: true,
  minimalNonHousing: 1500,
  fullServiceNonHousing: 4000,
  cheapestStrategy: 800,
  recommendedStrategy: 1250,
  comfortableStrategy: 2500,
};
