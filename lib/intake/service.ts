import "server-only";
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
        "Too few live listings to suggest a local rent range. Enter a rent ceiling or use optional income guidance.",
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
      "25th–75th percentile of matching live asking rents. A listing sample, not a citywide average or availability guarantee.",
  };
}

export async function enrichIntake(state: IntakeState) {
  const view = intakeView(state);
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
) {
  const extracted = prompt ? await extractRelocationDetails(prompt) : {};
  // A new, explicit request wins over saved context, including typed structured values.
  return enrichIntake(beginIntake({ ...known, ...extracted }, context, prompt));
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
