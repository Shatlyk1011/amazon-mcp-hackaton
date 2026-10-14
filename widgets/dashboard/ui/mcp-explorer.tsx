import { Bot, Check, GitBranch, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
export type Trace = {
  tool: string;
  status: string;
  duration: number;
  output: unknown;
};
export function McpExplorer({ traces }: { traces: Trace[] }) {
  return (
    <Card className="mt-5 rounded-xl bg-[#0e3030] text-white shadow-[0_8px_24px_rgba(14,48,48,0.16)]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>MCP execution explorer</CardTitle>
          <CardDescription>
            <span className="text-white/65">
              Live calls from the relocation workflow · safe outputs only
            </span>
          </CardDescription>
        </div>
        <Badge variant="secondary">
          <span className="mr-2 size-2 rounded-full bg-[#8be0b0]" />
          {traces.length ? "Workflow complete" : "Ready"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            "AI Agent",
            "MCP Client",
            "MoveFlow MCP",
            "Maps",
            "Housing",
            "Budget",
          ].map((label, index) => (
            <div
              key={label}
              className="relative rounded-lg border border-white/15 bg-[#155555]/45 p-3 text-center text-xs font-medium text-white/85"
            >
              <div className="mx-auto mb-2 grid size-8 place-items-center rounded-lg bg-white/10 text-[#c9b4fa]">
                {index === 0 ? (
                  <Bot className="size-4" />
                ) : index === 1 ? (
                  <GitBranch className="size-4" />
                ) : (
                  <Zap className="size-4" />
                )}
              </div>
              {label}
            </div>
          ))}
        </div>
        <ScrollArea className="mt-6 h-52 pr-3">
          <div className="flex flex-col gap-2">
            {traces.length === 0 ? (
              <div className="rounded-lg bg-white/10 p-4 text-sm text-white/65">
                Run a demo or create a plan to see tool execution history here.
              </div>
            ) : (
              traces.map((trace) => (
                <div
                  key={trace.tool}
                  className="flex items-center gap-3 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm"
                >
                  <span className="grid size-7 place-items-center rounded-lg bg-[#8be0b0]/15 text-[#8be0b0]">
                    <Check className="size-4" />
                  </span>
                  <span className="font-mono text-xs">{trace.tool}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {trace.duration} ms
                  </span>
                  <Badge className="bg-[#c9b4fa] text-[#1b1938] hover:bg-[#c9b4fa]">
                    completed
                  </Badge>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
