import { Check, CircleAlert, Clock3, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Trace = {
  tool: string;
  status: string;
  duration: number;
  output: unknown;
};

const toolLabels: Record<string, string> = {
  create_relocation_plan: "Relocation plan",
  calculate_route: "Driving route",
  suggest_flight_connections: "Flight routes",
  search_housing: "Housing search",
  search_moving_services: "Moving services",
  calculate_budget: "Budget estimate",
};

export function McpActivity({ traces }: { traces: Trace[] }) {
  const completed = traces.filter(
    (trace) => trace.status === "completed",
  ).length;

  return (
    <Card size="sm" className="rounded-xl ring-border">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Server aria-hidden="true" className="size-4" />
          <span className="font-mono text-xs uppercase">
            Execution activity
          </span>
        </div>
        <CardTitle>MCP servers</CardTitle>
        <CardDescription>
          {traces.length
            ? `${completed} of ${traces.length} calls completed`
            : "Create a plan to see server activity."}
        </CardDescription>
      </CardHeader>
      {traces.length > 0 && (
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <span className="text-sm font-medium">MoveFlow MCP</span>
            <Badge variant="secondary">{traces.length} calls</Badge>
          </div>
          <ul
            className="mt-3 grid max-h-80 gap-3 overflow-y-auto pr-1"
            aria-label="Executed tools"
          >
            {traces.map((trace, index) => {
              const isComplete = trace.status === "completed";
              const isError =
                trace.status === "error" || trace.status === "failed";
              const StatusIcon = isComplete
                ? Check
                : isError
                  ? CircleAlert
                  : Clock3;
              return (
                <li
                  key={`${trace.tool}-${index}`}
                  className="flex items-start gap-2"
                >
                  <StatusIcon
                    aria-hidden="true"
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium" title={trace.tool}>
                      {toolLabels[trace.tool] ??
                        trace.tool.replaceAll("_", " ")}
                    </div>
                    <div className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
                      <span className="capitalize">{trace.status}</span>
                      <span className="tabular-nums">{trace.duration} ms</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
