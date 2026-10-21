import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { PlanError } from "./errors";
import { intakeFieldsSchema, type IntakeFields } from "@/lib/intake/schema";

const extractedMoveSchema = z.object({
  scenario: z.enum(["alone", "family"]).nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  movingDate: z.string().nullable(),
  flexible: z.boolean().nullable(),
  budget: z.number().nullable(),
  adults: z.number().int().nullable(),
  children: z.number().int().nullable(),
  pets: z.number().int().nullable(),
  bedrooms: z.number().int().nullable(),
  suitcases: z.number().int().nullable(),
  furniture: z.boolean().nullable(),
  transport: z.enum(["drive", "fly", "compare"]).nullable(),
  needsHousing: z.boolean().nullable(),
  maxRent: z.number().nullable(),
  minBedrooms: z.number().int().nullable(),
  petFriendly: z.boolean().nullable(),
  neighborhood: z.string().nullable(),
  workInfo: z.string().nullable(),
  petInfo: z.string().nullable(),
  accessibilityNeeds: z.string().nullable(),
  otherNeeds: z.string().nullable(),
});

export async function extractRelocationDetails(
  prompt: string,
): Promise<IntakeFields> {
  if (!process.env.OPENAI_API_KEY)
    throw new PlanError(
      "OpenAI is not configured. Set OPENAI_API_KEY on the server.",
      503,
    );

  const now = new Date();
  try {
    const response = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 10_000,
    }).responses.parse(
      {
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions: `Extract relocation requirements from the user's message.
Today is ${now.toISOString().slice(0, 10)}. Resolve relative dates against today and return dates as YYYY-MM-DD.
Use null for every detail the user did not state or clearly imply. Never invent an origin or destination.
Scenario is family only when the user describes multiple adults or children; a pet alone does not make it a family move.
Transport is compare only when the user asks to compare options; otherwise leave it null if unstated.
When the user explicitly says they are moving alone, set adults to 1 and children to 0. Never assume they have no pets.
Keep a destination state such as Texas as Texas; do not silently choose a city.
Budget means the TOTAL one-time moving budget; maxRent means MONTHLY rent. Never use salary as either.
Preserve work constraints, pet details, accessibility needs and other priorities as plain data in the corresponding fields.
Return only the structured result.`,
        input: prompt,
        text: {
          format: zodTextFormat(extractedMoveSchema, "relocation_request"),
        },
      },
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!response.output_parsed)
      throw new PlanError(
        "The move details could not be understood. Try adding your origin and destination.",
        422,
      );
    return intakeFieldsSchema.parse(
      Object.fromEntries(
        Object.entries(response.output_parsed).filter(
          ([, value]) => value !== null,
        ),
      ),
    );
  } catch (error) {
    if (error instanceof PlanError) throw error;
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401)
        throw new PlanError(
          "OpenAI rejected the API key. Check OPENAI_API_KEY on the server.",
          503,
        );
      if (error.status === 429)
        throw new PlanError(
          "Voice-plan parsing is temporarily rate limited. Please try again shortly.",
          503,
        );
    }
    throw new PlanError(
      "The voice prompt could not be processed. Please try again.",
      503,
    );
  }
}
