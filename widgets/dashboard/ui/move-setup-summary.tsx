import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildMoveTimeline,
  assessMoveReadiness,
} from "@/lib/relocation-insights";
import type { Housing, Mover, RelocationInput } from "@/lib/relocation";
import type { RouteResult } from "@/lib/providers/mapbox";

export function MoveSetupSummary({
  input,
  route,
  housing,
  movers,
  selectedHousing,
  selectedMover,
  referenceDate,
}: {
  input: RelocationInput;
  route: RouteResult | null;
  housing: Housing[];
  movers: Mover[];
  selectedHousing: string | null;
  selectedMover: string | null;
  referenceDate: string;
}) {
  const schedule = buildMoveTimeline(input, referenceDate);
  const readiness = assessMoveReadiness({
    input,
    routeAvailable: Boolean(
      route?.originCoordinates && route?.destinationCoordinates,
    ),
    housingOptionsAvailable: housing.some((item) => !item.isDemoData),
    movingServicesAvailable: movers.some((item) => !item.isDemoData),
    selectedHousingId: selectedHousing,
    selectedMoverId: selectedMover,
    selectedHousingMonthlyRent: housing.find(
      (item) => item.id === selectedHousing,
    )?.monthlyRent,
  });
  const context = input.planningContext;
  return (
    <div className="mt-8 flex flex-col gap-6">
      {context ? (
        <Card>
          <CardHeader>
            <CardTitle>What this plan is based on</CardTitle>
            <CardDescription>
              {context.includedSavedContext
                ? "Your request, included saved context, and move-setup answers."
                : "Your request and move-setup answers."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Work and commute", context.workInfo],
                ["Pets", context.petInfo],
                ["Accessibility", context.accessibilityNeeds],
                ["Other priorities", context.otherNeeds],
              ]
                .filter(([, value]) => Boolean(value))
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                Assumptions and information sources
              </summary>
              <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
                <ul className="list-disc pl-4">
                  {context.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p>
                  Request:{" "}
                  {
                    Object.values(context.sources).filter(
                      (s) => s === "request",
                    ).length
                  }{" "}
                  facts · Saved context:{" "}
                  {
                    Object.values(context.sources).filter(
                      (s) => s === "saved_context",
                    ).length
                  }{" "}
                  facts · Setup answers:{" "}
                  {
                    Object.values(context.sources).filter((s) => s === "answer")
                      .length
                  }{" "}
                  facts
                </p>
                {context.rentEvidence ? (
                  <p>
                    Rent guidance: {context.rentEvidence.source},{" "}
                    {context.rentEvidence.sampleSize} listings in{" "}
                    {context.rentEvidence.destination}, checked{" "}
                    {context.rentEvidence.fetchedAt.slice(0, 10)}.{" "}
                    {context.rentEvidence.explanation}
                  </p>
                ) : null}
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Your moving checklist</CardTitle>
            <Badge variant="secondary">{readiness.score}% ready</Badge>
          </div>
          <CardDescription>
            {schedule.daysUntilMove >= 0
              ? `${schedule.daysUntilMove} days until your planned move.`
              : "Your planning date has passed; update it to revise the schedule."}{" "}
            Readiness reflects available information and selections, not
            confirmed bookings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-4">
            {schedule.timeline.map((task) => (
              <li
                key={task.id}
                className="flex items-start gap-4 border-l-2 border-border pl-4"
              >
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {task.dueDate}
                </span>
                <span className="text-sm">
                  {task.title}
                  {task.status === "overdue" ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Review now
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
