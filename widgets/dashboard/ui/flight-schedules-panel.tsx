import { Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FlightScheduleResult } from "@/lib/providers/demo-flights";

export function FlightSchedulesPanel({
  schedules,
}: {
  schedules: FlightScheduleResult;
}) {
  return (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Plane aria-hidden="true" />
            Flight options
          </CardTitle>
          <Badge
            variant={schedules.status === "live" ? "secondary" : "outline"}
          >
            {schedules.status === "live"
              ? "Route suggestions"
              : schedules.status === "fallback"
                ? "Made-up examples"
                : "Unavailable"}
          </Badge>
        </div>
        <CardDescription>
          {schedules.originAirport && schedules.destinationAirport
            ? `${schedules.originAirport} to ${schedules.destinationAirport} on ${schedules.departureDate}.`
            : `For ${schedules.origin} to ${schedules.destination} on ${schedules.departureDate}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {schedules.connections.length ? (
          <ul className="flex flex-col gap-3">
            {schedules.connections.slice(0, 4).map((connection) => (
              <li
                key={connection.id}
                className="rounded-lg border border-border p-3"
              >
                <p className="text-sm font-medium">
                  {connection.segments
                    .map(
                      (segment) =>
                        `${segment.airline} ${segment.flightNumber} · ${segment.originAirport} → ${segment.destinationAirport}`,
                    )
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {schedules.status === "fallback"
                    ? connection.stops === 0
                      ? "Example: direct flight"
                      : "Example: one-stop flight"
                    : connection.stops === 0
                      ? "Nonstop route"
                      : "Possible connecting flight — check the transfer"}
                </p>
                {schedules.status !== "fallback" &&
                  connection.segments.map((segment, index) => (
                    <p
                      key={`${segment.flightNumber}-${index}`}
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {segment.flightNumber}:{" "}
                      {segment.departureTime
                        ? `departs ${segment.departureTime} local`
                        : "departure time unknown"}
                      {segment.arrivalTime
                        ? ` · arrives ${segment.arrivalTime} local`
                        : ""}
                      {segment.days?.length
                        ? ` · ${segment.days.join(", ")}`
                        : " · flight days unknown"}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No flight route suggestions were returned for this search.
          </p>
        )}
        {schedules.warning ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {schedules.warning}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
