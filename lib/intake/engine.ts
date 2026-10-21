import { groupCitiesByState } from "@mardillu/us-cities-utils";
import { relocationInputSchema, type RelocationInput } from "@/lib/relocation";
import { isUsLocation, US_ONLY_ERROR } from "@/lib/us-location";
import { PlanError } from "@/lib/plans/errors";
import {
  intakeFieldsSchema,
  intakeStateSchema,
  type IntakeAnswer,
  type IntakeFields,
  type IntakeQuestion,
  type IntakeState,
  type IntakeView,
} from "./schema";

const citiesByState = groupCitiesByState();
const states = Object.entries(citiesByState).map(([abbreviation, cities]) => ({
  name: cities[0]?.state ?? abbreviation,
  abbreviation,
  cities,
}));
// Accept a state name or postal abbreviation without treating it as a city.
function stateOnly(value?: string) {
  const text = value
    ?.trim()
    .toLowerCase()
    .replace(/^state of /, "");
  return states.find(
    (s) =>
      s.name.toLowerCase() === text || s.abbreviation?.toLowerCase() === text,
  );
}
function cityNeeded(value?: string) {
  return (
    !value ||
    Boolean(stateOnly(value)) ||
    /^(usa|us|united states|america)$/i.test(value.trim())
  );
}
function inDays(referenceDate: string, days: number) {
  const date = new Date(`${referenceDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export function beginIntake(
  request: IntakeFields = {},
  context: IntakeFields = {},
  prompt = "",
  now = new Date(),
): IntakeState {
  const saved = intakeFieldsSchema.parse(context);
  const explicit = intakeFieldsSchema.parse(request);
  const fields = { ...saved, ...explicit };
  const sources: IntakeState["sources"] = {};
  for (const key of Object.keys(saved)) sources[key] = "saved_context";
  for (const key of Object.keys(explicit)) sources[key] = "request";
  if (explicit.pets !== undefined) {
    fields.petFriendly = explicit.petFriendly ?? explicit.pets > 0;
    sources.petFriendly = "request";
    if (explicit.petInfo === undefined && explicit.pets !== saved.pets) {
      delete fields.petInfo;
      delete sources.petInfo;
    }
  }
  if (explicit.bedrooms !== undefined && explicit.minBedrooms === undefined) {
    fields.minBedrooms = explicit.bedrooms;
    sources.minBedrooms = "request";
  }
  if (explicit.minBedrooms !== undefined && explicit.bedrooms === undefined) {
    fields.bedrooms = Math.max(1, explicit.minBedrooms);
    sources.bedrooms = "request";
  }
  return intakeStateSchema.parse({
    prompt,
    referenceDate: now.toISOString().slice(0, 10),
    fields,
    sources,
    contextIncluded: Object.keys(saved).length > 0,
  });
}

function locationQuestion(
  id: "origin" | "destination",
  value?: string,
): IntakeQuestion {
  const state = stateOnly(value);
  const popularByState: Record<string, string[]> = {
    TX: ["Austin, TX", "Dallas, TX", "Houston, TX", "San Antonio, TX"],
    NY: ["New York, NY", "Buffalo, NY", "Albany, NY"],
    CA: ["Los Angeles, CA", "San Francisco, CA", "San Diego, CA"],
  };
  const popular =
    (state &&
      (popularByState[state.abbreviation] ??
        [
          ...new Set(state.cities.map((c) => `${c.name}, ${c.stateAbbr}`)),
        ].slice(0, 4))) ??
    [];
  return {
    id,
    title:
      id === "origin"
        ? "Which city are you moving from?"
        : `Which city${state ? ` in ${state.name}` : ""} are you moving to?`,
    description:
      "A city lets us find the right route, homes, and local services.",
    placeholder: "Enter city and state",
    options: popular.map((city) => ({
      id: city,
      label: city,
      values: { [id]: city },
    })),
  };
}

export function pendingQuestions(state: IntakeState): IntakeQuestion[] {
  const f = state.fields;
  const questions: IntakeQuestion[] = [];
  if (cityNeeded(f.origin))
    questions.push(locationQuestion("origin", f.origin));
  if (cityNeeded(f.destination))
    questions.push(locationQuestion("destination", f.destination));
  if (f.adults === undefined || f.children === undefined)
    questions.push({
      id: "household",
      title: "Who is making this move?",
      description:
        "We use household size for travel, home size, and moving costs. For a custom answer, enter adults and children, e.g. 2 adults, 3 children.",
      placeholder: "2 adults, 3 children",
      options: [
        { id: "solo", label: "Just me", values: { adults: 1, children: 0 } },
        {
          id: "couple",
          label: "Two adults",
          values: { adults: 2, children: 0 },
        },
        {
          id: "family",
          label: "2 adults + 1 child",
          values: { adults: 2, children: 1 },
        },
      ],
    });
  if (!f.movingDate || f.movingDate < state.referenceDate)
    questions.push({
      id: "movingDate",
      title: "When would you like to move?",
      description:
        "Choose a planning date or enter an exact date. You can change it later.",
      placeholder: "YYYY-MM-DD",
      inputType: "date",
      options: [30, 60, 90].map((days) => ({
        id: String(days),
        label: `In about ${days} days`,
        values: {
          movingDate: inDays(state.referenceDate, days),
          flexible: true,
        },
      })),
    });
  if (f.needsHousing === undefined)
    questions.push({
      id: "housing",
      title: "Will you need a home at the destination?",
      description:
        "We can search rentals or plan around a home you already have.",
      placeholder: "Yes, search rentals / No, I have a home",
      options: [
        { id: "yes", label: "Find a rental", values: { needsHousing: true } },
        {
          id: "no",
          label: "I already have housing",
          values: { needsHousing: false },
        },
      ],
    });
  if (f.furniture === undefined)
    questions.push({
      id: "belongings",
      title: "What are you taking with you?",
      description:
        "This determines whether to include movers and packing costs.",
      placeholder: "Furniture and boxes / Luggage only",
      options: [
        { id: "luggage", label: "Luggage only", values: { furniture: false } },
        {
          id: "furniture",
          label: "Furniture + boxes",
          values: { furniture: true },
        },
      ],
    });
  if (f.needsHousing !== false && f.maxRent === undefined) {
    const g = state.rentGuidance;
    const live =
      g?.status === "live" &&
      g.destination === f.destination &&
      g.bedrooms === (f.minBedrooms ?? f.bedrooms ?? 1) &&
      g.sampleSize >= 3 &&
      g.low &&
      g.median &&
      g.high;
    questions.push({
      id: "rent",
      title: "What monthly rent feels comfortable?",
      description: live
        ? `${g.destination}: sampled ${g.bedrooms}-bedroom asking rents range from ${money(g.low!)} to ${money(g.high!)}; median ${money(g.median!)} (${g.sampleSize} listings, ${g.source}). This is a listing sample, not a citywide average.`
        : "Enter a monthly rent limit, or use 30% of monthly take-home income as a starting point. Income is optional. Local price guidance is currently unavailable.",
      placeholder: "Monthly rent limit in USD",
      inputType: "number",
      options: live
        ? [
            {
              id: "market-low",
              label: `${money(g.low!)} · lower sample`,
              values: { maxRent: g.low },
              source: "market",
            },
            {
              id: "market-mid",
              label: `${money(g.median!)} · median sample`,
              values: { maxRent: g.median },
              source: "market",
            },
            {
              id: "market-high",
              label: `${money(g.high!)} · higher sample`,
              values: { maxRent: g.high },
              source: "market",
            },
          ]
        : [],
    });
  }
  if (f.budget === undefined) {
    questions.push({
      id: "budget",
      title: "What is your total moving budget?",
      description:
        "Enter the total amount you have available for the move, separate from your monthly rent limit.",
      placeholder: "Total move budget in USD",
      inputType: "number",
      options: [],
    });
  }
  return questions;
}

export function intakeView(raw: IntakeState): IntakeView {
  const state = intakeStateSchema.parse(raw);
  const questions = pendingQuestions(state);
  const assumptions = [
    "Cost estimates are planning estimates, not travel or mover quotes.",
    ...(state.fields.pets === undefined
      ? ["No pets are included unless you add them to your move details."]
      : []),
    ...(state.fields.suitcases === undefined
      ? ["Packing allowance uses two suitcases per traveler unless specified."]
      : []),
    ...(state.sources.maxRent === "income"
      ? [
          "Rent ceiling uses 30% of monthly take-home income as a user-selected starting point.",
        ]
      : []),
  ];
  return {
    state,
    ready: questions.length === 0,
    questions,
    nextQuestion: questions[0] ?? null,
    remainingQuestions: questions.length,
    assumptions,
    summary: Object.entries(state.fields)
      .filter(
        ([key]) =>
          key !== "scenario" &&
          !(
            state.fields.needsHousing === false &&
            ["maxRent", "minBedrooms"].includes(key)
          ),
      )
      .map(([field, value]) => ({
        field,
        value: String(value),
        source: state.sources[field] ?? "answer",
      })),
  };
}

export function applyIntakeFields(
  state: IntakeState,
  raw: IntakeFields,
  source: "answer" | "income" | "market" = "answer",
): IntakeState {
  const changes = intakeFieldsSchema.parse(raw);
  const fields = { ...state.fields, ...changes };
  const sources = { ...state.sources };
  for (const key of Object.keys(changes)) sources[key] = source;
  const changedMarket =
    fields.destination !== state.fields.destination ||
    fields.minBedrooms !== state.fields.minBedrooms ||
    fields.bedrooms !== state.fields.bedrooms;
  return intakeStateSchema.parse({
    ...state,
    fields,
    sources,
    rentGuidance: changedMarket ? undefined : state.rentGuidance,
  });
}

export function answerIntake(
  state: IntakeState,
  answer: IntakeAnswer,
): IntakeState {
  const q = pendingQuestions(state)[0];
  if (!q || q.id !== answer.questionId)
    throw new PlanError(
      "This question has changed. Reload the latest move setup.",
      409,
    );
  if (answer.choice) {
    const option = q.options.find((item) => item.id === answer.choice);
    if (!option)
      throw new PlanError("Choose an available answer or enter your own.", 422);
    return applyIntakeFields(state, option.values, option.source ?? "answer");
  }
  if (q.id === "rent" && answer.monthlyIncome)
    return applyIntakeFields(
      state,
      { maxRent: Math.round(answer.monthlyIncome * 0.3) },
      "income",
    );
  const text = answer.text?.trim() ?? "";
  if (!text) throw new PlanError("Select an answer or type your own.", 422);
  if (q.id === "origin" || q.id === "destination") {
    if (cityNeeded(text))
      throw new PlanError(
        "Please choose a city rather than a whole state or country.",
        422,
      );
    if (!isUsLocation(text)) throw new PlanError(US_ONLY_ERROR, 422);
    return applyIntakeFields(state, { [q.id]: text });
  }
  if (["bedrooms", "rent", "budget"].includes(q.id)) {
    const n = Number(text.replace(/[$,]/g, ""));
    if (
      !Number.isFinite(n) ||
      n <= 0 ||
      (q.id === "bedrooms" && (!Number.isInteger(n) || n > 20))
    )
      throw new PlanError("Enter a valid positive amount.", 422);
    return applyIntakeFields(
      state,
      q.id === "bedrooms"
        ? { minBedrooms: n, bedrooms: n }
        : q.id === "rent"
          ? { maxRent: n }
          : { budget: n },
    );
  }
  if (q.id === "movingDate") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text < state.referenceDate)
      throw new PlanError("Choose today or a future date.", 422);
    return applyIntakeFields(state, { movingDate: text, flexible: false });
  }
  // Free-form answers for household, pet details, travel, and belongings are
  // interpreted by the shared server service, then validated against this step.
  throw new PlanError(
    "Please choose an answer or describe this detail in words.",
    422,
  );
}

export function completeIntake(state: IntakeState): RelocationInput {
  const view = intakeView(state);
  if (!view.ready)
    throw new PlanError(
      `More information is needed: ${view.nextQuestion!.title}`,
      422,
    );
  const f = state.fields;
  const adults = f.adults!;
  const children = f.children!;
  return relocationInputSchema.parse({
    ...f,
    scenario: adults + children > 1 ? "family" : "alone",
    flexible: f.flexible ?? false,
    pets: f.pets ?? 0,
    transport: f.transport ?? "compare",
    expenseEstimates: state.expenseEstimates,
    bedrooms: f.bedrooms ?? Math.max(1, f.minBedrooms ?? 1),
    minBedrooms: f.needsHousing ? (f.minBedrooms ?? f.bedrooms ?? 0) : 0,
    maxRent: f.needsHousing ? f.maxRent : 0,
    suitcases: f.suitcases ?? 2 * (adults + children),
    petFriendly: f.petFriendly ?? (f.pets ?? 0) > 0,
    planningContext: {
      includedSavedContext: state.contextIncluded,
      workInfo: f.workInfo,
      petInfo: f.petInfo,
      accessibilityNeeds: f.accessibilityNeeds,
      otherNeeds: f.otherNeeds,
      sources: state.sources,
      assumptions: view.assumptions,
      rentEvidence:
        state.sources.maxRent === "market" ? state.rentGuidance : undefined,
    },
  });
}
