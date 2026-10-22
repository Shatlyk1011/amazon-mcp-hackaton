import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  states,
  stateOnly,
  resolveState,
  statesFromMovePrompt,
} from "./cities";
import { searchHousing } from "@/lib/providers/rentcast";
import { extractRelocationDetails } from "@/lib/plans/prompt";
import { PlanError } from "@/lib/plans/errors";
import {
  answerIntake,
  applyIntakeFields,
  beginIntake,
  intakeView,
} from "./engine";
import {
  intakeFieldsSchema,
  type IntakeAnswer,
  type IntakeFields,
  type IntakeState,
  type RentGuidance,
} from "./schema";

// Suggestions are optional: a provider failure must never block manual entry.
export async function getCitySuggestions(
  stateName?: string,
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const state = stateOnly(stateName);
  if (stateName && !state) return [];
  try {
    const response = await new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 10000,
    }).responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions:
        "Suggest three distinct, well-known US cities for a moving questionnaire. Return city and two-letter state abbreviation, e.g. Austin, TX. If a state is specified, all cities must be in that state. Do not select a city for the user.",
      input: state
        ? `State: ${state.name} (${state.abbreviation})`
        : "No state is known; suggest cities from different states.",
      text: {
        format: zodTextFormat(
          z.object({ cities: z.array(z.string()).max(3) }),
          "city_suggestions",
        ),
      },
    });
    const candidates = response.output_parsed?.cities ?? [];
    const valid = new Map<string, string>();
    for (const item of state ? [state] : states) {
      for (const city of item.cities) {
        const label = `${city.name}, ${item.abbreviation}`;
        valid.set(label.toLowerCase(), label);
      }
    }
    return [
      ...new Set(
        candidates
          .map((city) => valid.get(city.trim().toLowerCase()))
          .filter((city): city is string => Boolean(city)),
      ),
    ].slice(0, 3);
  } catch {
    return [];
  }
}

export async function getRentGuidance(
  destination: string,
  bedrooms: number,
): Promise<RentGuidance> {
  const result = await searchHousing({ destination, bedrooms, liveOnly: true });
  // Development data must never masquerade as local market evidence.
  const rents =
    result.status === "live"
      ? result.listings
          .filter(
            (h) =>
              !h.isDemoData && h.monthlyRent > 0 && h.bedrooms === bedrooms,
          )
          .map((h) => h.monthlyRent)
          .sort((a, b) => a - b)
      : [];
  const base = {
    destination,
    bedrooms,
    sampleSize: rents.length,
    source: result.source,
    fetchedAt: result.fetchedAt,
  };
  if (rents.length < 3)
    return {
      ...base,
      status: "unavailable",
      explanation:
        "There are too few current listings to suggest a local rent range. Enter a rent limit or use your income to help choose one.",
    };
  const percentile = (p: number) =>
    Math.round(rents[Math.floor((rents.length - 1) * p)] / 25) * 25;
  return {
    ...base,
    status: "live",
    low: percentile(0.25),
    median: percentile(0.5),
    high: percentile(0.75),
    explanation:
      "The middle half of asking rents in the matching current listings. This is not a citywide average or a guarantee that homes are available.",
  };
}

export async function enrichIntake(state: IntakeState) {
  let view = intakeView(state);
  const missingCities = view.questions.filter(
    (q) =>
      (q.id === "origin" || q.id === "destination") &&
      state.citySuggestions?.[q.id] === undefined,
  );
  if (missingCities.length) {
    const suggestions = await Promise.all(
      missingCities.map((q) =>
        getCitySuggestions(
          stateOnly(state.fields[q.id as "origin" | "destination"])?.name,
        ),
      ),
    );
    state = {
      ...state,
      citySuggestions: {
        ...state.citySuggestions,
        ...Object.fromEntries(
          missingCities.map((q, index) => [q.id, suggestions[index]]),
        ),
      },
    };
    view = intakeView(state);
  }
  if (view.nextQuestion?.id !== "rent") return view;
  const bedrooms = state.fields.minBedrooms ?? state.fields.bedrooms ?? 1;
  const previous = state.rentGuidance;
  if (
    previous &&
    previous.destination === state.fields.destination &&
    previous.bedrooms === bedrooms
  )
    return view;
  return intakeView({
    ...state,
    rentGuidance: await getRentGuidance(state.fields.destination!, bedrooms),
  });
}

export async function prepareIntake(
  prompt: string,
  known: IntakeFields = {},
  context: IntakeFields = {},
  contextText = "",
) {
  let extracted: IntakeFields = {};
  let extractionFailed = false;
  let extractedContext: IntakeFields = {};
  if (contextText.trim()) {
    try {
      extractedContext = await extractRelocationDetails(contextText);
    } catch (error) {
      if (!(error instanceof PlanError)) throw error;
      throw new PlanError(
        "Your move context could not be interpreted. Please retry or continue without it.",
        503,
      );
    }
  }
  if (prompt) {
    try {
      extracted = await extractRelocationDetails(prompt);
    } catch (error) {
      if (!(error instanceof PlanError)) throw error;
      extractionFailed = true;
    }
  }
  // Recover unambiguous state-only routes when extraction omitted them, and
  // normalize simple misspellings without replacing an extracted city.
  const promptStates = statesFromMovePrompt(prompt);
  const request = { ...promptStates, ...extracted, ...known };
  for (const field of ["origin", "destination"] as const) {
    const normalized = resolveState(request[field]);
    if (normalized) request[field] = normalized.name;
  }
  // A new, explicit request wins over saved context, including typed structured values.
  const state = beginIntake(
    request,
    { ...context, ...extractedContext },
    prompt,
  );
  if (contextText.trim()) state.contextIncluded = true;
  const view = await enrichIntake(state);
  return extractionFailed
    ? {
        ...view,
        extractionWarning:
          "The request text could not be interpreted automatically. Review the captured details and provide any missing information during the intake.",
      }
    : view;
}

const questionFields: Record<string, (keyof IntakeFields)[]> = {
  household: ["adults", "children"],
  pets: ["pets", "petInfo", "petFriendly"],
  housing: ["needsHousing"],
  belongings: ["furniture", "bedrooms", "suitcases"],
  transport: ["transport"],
  priorities: ["workInfo", "accessibilityNeeds", "otherNeeds"],
};
export async function continueIntake(state: IntakeState, answer: IntakeAnswer) {
  const question = intakeView(state).nextQuestion;
  if (!question || question.id !== answer.questionId)
    throw new PlanError(
      "This question has changed. Reload the latest move setup.",
      409,
    );
  const allowed = questionFields[question.id];
  if (!answer.choice && answer.text && allowed) {
    const extracted = await extractRelocationDetails(
      `The user is answering only this relocation question: ${question.title}\nAnswer: ${answer.text}\nExtract only what is stated in that answer.`,
    );
    const changes = intakeFieldsSchema.parse(
      Object.fromEntries(
        Object.entries(extracted).filter(([key]) =>
          allowed.includes(key as keyof IntakeFields),
        ),
      ),
    );
    const next = applyIntakeFields(state, changes);
    if (intakeView(next).nextQuestion?.id === question.id)
      throw new PlanError(
        "Please include the missing detail or choose one of the suggested answers.",
        422,
      );
    return enrichIntake(next);
  }
  return enrichIntake(answerIntake(state, answer));
}

// The browser collects the whole visible questionnaire before persisting. Keep
// validation sequential so conditional questions and free-text extraction use
// exactly the same rules as the one-at-a-time MCP flow.
export async function continueIntakeBatch(
  state: IntakeState,
  answers: IntakeAnswer[],
) {
  let view = intakeView(state);
  for (const answer of answers) view = await continueIntake(view.state, answer);
  return view;
}
