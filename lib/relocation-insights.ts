import { z } from "zod";
import {
  calculateBudget,
  relocationInputSchema,
  type RelocationInput,
} from "@/lib/relocation";

export const housingComparisonOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  address: z.string(),
  monthlyRent: z.number().nonnegative(),
  bedrooms: z.number().nonnegative(),
  bathrooms: z.number().nonnegative(),
  availability: z.enum(["Listed as available", "Unknown"]),
});

export const housingComparisonSchema = z
  .object({
    input: relocationInputSchema,
    options: z.array(housingComparisonOptionSchema).min(2).max(5),
  })
  .strict();

export const readinessSnapshotSchema = z
  .object({
    input: relocationInputSchema,
    routeAvailable: z.boolean().default(false),
    housingOptionsAvailable: z.boolean().default(false),
    movingServicesAvailable: z.boolean().default(false),
    selectedHousingId: z.string().nullable().default(null),
    selectedMoverId: z.string().nullable().default(null),
    selectedHousingMonthlyRent: z.number().nonnegative().optional(),
  })
  .strict();

export type ReadinessSnapshot = z.infer<typeof readinessSnapshotSchema>;

function parseDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftDate(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function daysUntilMove(movingDate: string, referenceDate: string) {
  return Math.ceil(
    (parseDate(movingDate).getTime() - parseDate(referenceDate).getTime()) /
      86_400_000,
  );
}

export function buildMoveTimeline(
  input: RelocationInput,
  referenceDate = isoDate(new Date()),
) {
  const tasks = [
    {
      id: "confirm-plan",
      title: "Check your moving budget and what your family needs",
      dueDate: shiftDate(input.movingDate, -56),
      category: "planning",
    },
    ...(input.needsHousing
      ? [
          {
            id: "choose-housing",
            title: "Compare homes and choose one in your new city",
            dueDate: shiftDate(input.movingDate, -42),
            category: "housing",
          },
        ]
      : []),
    ...(input.furniture
      ? [
          {
            id: "choose-mover",
            title: "Compare moving companies and check if they are available",
            dueDate: shiftDate(input.movingDate, -35),
            category: "moving",
          },
        ]
      : []),
    {
      id: "book-travel",
      title: `Confirm ${input.transport === "compare" ? "travel method" : input.transport} and the arrival plan`,
      dueDate: shiftDate(input.movingDate, -28),
      category: "travel",
    },
    {
      id: "utilities-address",
      title: "Set up utilities and plan your address change",
      dueDate: shiftDate(input.movingDate, -14),
      category: "settling-in",
    },
    {
      id: "essentials",
      title: "Find nearby places you will need in your first week",
      dueDate: shiftDate(input.movingDate, -10),
      category: "settling-in",
    },
    {
      id: "final-pack",
      title: input.furniture
        ? "Finish packing and confirm the mover arrival window"
        : "Finish packing luggage and important documents",
      dueDate: shiftDate(input.movingDate, -3),
      category: "moving",
    },
    {
      id: "move-day",
      title: "Move day",
      dueDate: input.movingDate,
      category: "move-day",
    },
  ];

  const timeline = tasks
    .map((task) => ({
      ...task,
      daysFromNow: daysUntilMove(task.dueDate, referenceDate),
      status:
        task.dueDate < referenceDate
          ? ("overdue" as const)
          : task.dueDate === referenceDate
            ? ("due-today" as const)
            : ("upcoming" as const),
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    referenceDate,
    movingDate: input.movingDate,
    daysUntilMove: daysUntilMove(input.movingDate, referenceDate),
    nextTask:
      timeline.find((task) => task.status !== "overdue") ?? timeline.at(-1),
    timeline,
  };
}

export function assessMoveReadiness(raw: ReadinessSnapshot) {
  const snapshot = readinessSnapshotSchema.parse(raw);
  const selectedHousing =
    snapshot.selectedHousingMonthlyRent !== undefined
      ? { monthlyRent: snapshot.selectedHousingMonthlyRent }
      : undefined;
  const budget = calculateBudget(snapshot.input, selectedHousing);
  const checks = [
    {
      id: "route",
      label:
        snapshot.input.transport === "fly"
          ? "Travel method chosen"
          : "Route understood",
      ready: snapshot.input.transport === "fly" || snapshot.routeAvailable,
      weight: 15,
      action:
        snapshot.input.transport === "fly"
          ? "Confirm flights and arrival details."
          : "Calculate the route and travel time.",
    },
    {
      id: "housing-options",
      label: "Housing options available",
      ready: !snapshot.input.needsHousing || snapshot.housingOptionsAvailable,
      weight: 15,
      action: "Find homes that match what you need.",
    },
    {
      id: "housing-selection",
      label: "Housing decision made",
      ready:
        !snapshot.input.needsHousing || Boolean(snapshot.selectedHousingId),
      weight: 25,
      action: "Compare homes and choose one.",
    },
    {
      id: "moving-options",
      label: "Moving services available",
      ready: !snapshot.input.furniture || snapshot.movingServicesAvailable,
      weight: 10,
      action: "Find moving companies near your starting city.",
    },
    {
      id: "mover-selection",
      label: "Moving service decision made",
      ready: !snapshot.input.furniture || Boolean(snapshot.selectedMoverId),
      weight: 15,
      action: "Compare moving companies and choose one.",
    },
    {
      id: "budget",
      label: "Estimated cost fits your budget",
      ready: budget.remaining !== null && budget.remaining >= 0,
      weight: 20,
      action:
        budget.remaining === null
          ? "Add your budget to compare it with the estimated cost."
          : `Close the ${Math.abs(budget.remaining).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} budget gap or revise the plan.`,
    },
  ];
  const score = checks.reduce(
    (total, check) => total + (check.ready ? check.weight : 0),
    0,
  );
  const blockers = checks.filter((check) => !check.ready);

  return {
    score,
    status:
      score >= 85 ? "ready" : score >= 55 ? "in-progress" : "needs-attention",
    checks: checks.map((check) => ({
      id: check.id,
      label: check.label,
      ready: check.ready,
      weight: check.weight,
    })),
    blockers: blockers.map(({ id, label, action }) => ({ id, label, action })),
    nextAction: blockers[0]?.action ?? "Review the final move-day checklist.",
    budget,
  };
}

export function compareHousingOptions(
  input: RelocationInput,
  options: z.infer<typeof housingComparisonOptionSchema>[],
) {
  return options
    .map((option) => {
      let score = 0;
      const strengths: string[] = [];
      const tradeoffs: string[] = [];
      if (option.monthlyRent <= input.maxRent) {
        score += 50;
        strengths.push("Within the monthly rent limit");
      } else {
        const overage = option.monthlyRent - input.maxRent;
        score += Math.max(
          0,
          50 - Math.ceil((overage / Math.max(input.maxRent, 1)) * 100),
        );
        tradeoffs.push(
          `Over the monthly rent limit by $${overage.toLocaleString("en-US")}`,
        );
      }
      if (option.bedrooms >= input.minBedrooms) {
        score += 30;
        strengths.push("Meets the bedroom requirement");
      } else {
        tradeoffs.push("Does not meet the bedroom requirement");
      }
      if (option.availability === "Listed as available") {
        score += 15;
        strengths.push("Listed as available");
      } else {
        tradeoffs.push("Check if it is available");
      }
      if (option.address.trim()) score += 5;
      if (input.petFriendly)
        tradeoffs.push("Check the pet rules with the listing provider");
      return { ...option, score, strengths, tradeoffs };
    })
    .sort((a, b) => b.score - a.score || a.monthlyRent - b.monthlyRent)
    .map((option, index) => ({ ...option, rank: index + 1 }));
}

export function createMoveBriefing(
  snapshot: ReadinessSnapshot,
  referenceDate = isoDate(new Date()),
) {
  const readiness = assessMoveReadiness(snapshot);
  const timeline = buildMoveTimeline(snapshot.input, referenceDate);
  const countdown = timeline.daysUntilMove;
  const countdownText =
    countdown > 0
      ? `${countdown} days until your move.`
      : countdown === 0
        ? "Today is move day."
        : `The saved move date passed ${Math.abs(countdown)} days ago.`;
  const budgetText =
    readiness.budget.remaining === null
      ? "Add your budget to see how it compares with the estimated cost."
      : readiness.budget.remaining >= 0
        ? `$${readiness.budget.remaining.toLocaleString("en-US")} is left after the estimated cost.`
        : `The estimated cost is $${Math.abs(readiness.budget.remaining).toLocaleString("en-US")} over budget.`;

  return {
    summary: `${countdownText} The plan is ${readiness.score}% ready. ${budgetText}`,
    referenceDate,
    daysUntilMove: countdown,
    readinessScore: readiness.score,
    readinessStatus: readiness.status,
    budgetStatus: budgetText,
    nextAction: readiness.nextAction,
    nextTimelineTask: timeline.nextTask,
  };
}
