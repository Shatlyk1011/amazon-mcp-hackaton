import { z } from "zod";

const amount = z.number().finite().min(0).max(1_000_000);

// Estimates are separate from user facts and live provider prices.
export const movingEstimatesSchema = z
  .object({
    source: z.enum(["model", "user"]),
    monthlyRent: amount.optional(),
    transportation: amount.optional(),
    moving: amount.optional(),
    temporaryAccommodation: amount.optional(),
    additional: amount.optional(),
    housingFees: amount.optional(),
    includeSecurityDeposit: z.boolean().optional(),
    minimalNonHousing: amount.optional(),
    fullServiceNonHousing: amount.optional(),
    cheapestStrategy: amount.optional(),
    recommendedStrategy: amount.optional(),
    comfortableStrategy: amount.optional(),
  })
  .strict();

export type MovingEstimates = z.infer<typeof movingEstimatesSchema>;
