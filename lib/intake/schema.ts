import { z } from "zod";
import { usIntakeLocationSchema } from "@/lib/us-location";
import { relocationInputSchema } from "@/lib/relocation";
import { movingEstimatesSchema } from "@/lib/moving-estimates";

// No defaults: an absent fact must remain absent until the user supplies it.
export const intakeFieldsSchema = relocationInputSchema
  .omit({ planningContext: true, expenseEstimates: true })
  .partial()
  .extend({
    origin: usIntakeLocationSchema.optional(),
    destination: usIntakeLocationSchema.optional(),
    adults: z.number().int().min(1).max(20).optional(),
    children: z.number().int().min(0).max(20).optional(),
    pets: z.number().int().min(0).max(20).optional(),
    bedrooms: z.number().int().min(1).max(20).optional(),
    minBedrooms: z.number().int().min(0).max(20).optional(),
    workInfo: z.string().trim().max(1500).optional(),
    petInfo: z.string().trim().max(1000).optional(),
    accessibilityNeeds: z.string().trim().max(1000).optional(),
    otherNeeds: z.string().trim().max(1500).optional(),
  })
  .strict();

export const factSourceSchema = z.enum([
  "request",
  "saved_context",
  "answer",
  "market",
  "income",
]);
export const rentGuidanceSchema = z.object({
  destination: z.string(),
  bedrooms: z.number().int().nonnegative(),
  status: z.enum(["live", "unavailable"]),
  low: z.number().positive().optional(),
  median: z.number().positive().optional(),
  high: z.number().positive().optional(),
  sampleSize: z.number().int().nonnegative(),
  source: z.string(),
  fetchedAt: z.string(),
  explanation: z.string(),
});
export const intakeStateSchema = z
  .object({
    prompt: z.string().max(4000),
    referenceDate: z.iso.date(),
    fields: intakeFieldsSchema,
    sources: z.record(z.string(), factSourceSchema),
    contextIncluded: z.boolean(),
    rentGuidance: rentGuidanceSchema.optional(),
    citySuggestions: z
      .object({
        origin: z.array(z.string().max(100)).max(3).optional(),
        destination: z.array(z.string().max(100)).max(3).optional(),
      })
      .optional(),
    expenseEstimates: movingEstimatesSchema.optional(),
  })
  .strict();
export const intakeAnswerSchema = z
  .object({
    questionId: z.string().max(50),
    choice: z.string().max(100).optional(),
    text: z.string().trim().max(2000).optional(),
    monthlyIncome: z.number().positive().max(1000000).optional(),
  })
  .strict();
export const intakeAnswersSchema = z.array(intakeAnswerSchema).min(1).max(20);
export type IntakeFields = z.infer<typeof intakeFieldsSchema>;
export type IntakeState = z.infer<typeof intakeStateSchema>;
export type IntakeAnswer = z.infer<typeof intakeAnswerSchema>;
export type RentGuidance = z.infer<typeof rentGuidanceSchema>;
export type IntakeQuestion = {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  inputType?: "text" | "number" | "date";
  options: {
    id: string;
    label: string;
    values: IntakeFields;
    source?: "market";
  }[];
};
export type IntakeView = {
  state: IntakeState;
  ready: boolean;
  questions: IntakeQuestion[];
  nextQuestion: IntakeQuestion | null;
  remainingQuestions: number;
  summary: { field: string; value: string; source: string }[];
  assumptions: string[];
};
export type SavedIntakeView = IntakeView & {
  id: string;
  version: number;
  canGoBack: boolean;
  planId?: string;
};
