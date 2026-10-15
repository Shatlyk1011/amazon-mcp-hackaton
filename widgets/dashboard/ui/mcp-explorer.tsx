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
    <Card className="mt-5 rounded-xl bg-white text-[#171717] shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb] dark:bg-[#171717] dark:text-white dark:ring-[#4d4d4d]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>MCP execution explorer</CardTitle>
          <CardDescription>
            <span className="text-[#4d4d4d] dark:text-white/65">
              Live calls from the relocation workflow · safe outputs only
            </span>
          </CardDescription>
        </div>
        <Badge variant="secondary">
          <span className="mr-2 size-2 rounded-full bg-[#0070f3]" />
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
              className="relative rounded-lg border border-[#ebebeb] bg-[#fafafa] p-3 text-center text-xs font-medium text-[#4d4d4d] dark:border-[#4d4d4d] dark:bg-white/5 dark:text-white/85"
            >
              <div className="mx-auto mb-2 grid size-8 place-items-center rounded-md bg-[#f2f2f2] text-[#0070f3] dark:bg-white/10 dark:text-[#50e3c2]">
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
              <div className="rounded-lg border border-[#ebebeb] bg-[#fafafa] p-4 text-sm text-[#4d4d4d] dark:border-[#4d4d4d] dark:bg-white/5 dark:text-white/65">
                Run a demo or create a plan to see tool execution history here.
              </div>
            ) : (
              traces.map((trace) => (
                <div
                  key={trace.tool}
                  className="flex items-center gap-3 rounded-lg border border-[#ebebeb] bg-[#fafafa] px-3 py-2.5 text-sm dark:border-[#4d4d4d] dark:bg-white/5"
                >
                  <span className="grid size-7 place-items-center rounded-md bg-[#d3e5ff] text-[#0070f3] dark:bg-[#50e3c2]/15 dark:text-[#50e3c2]">
                    <Check className="size-4" />
                  </span>
                  <span className="font-mono text-xs">{trace.tool}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {trace.duration} ms
                  </span>
                  <Badge className="bg-[#d3e5ff] text-[#0761d1] hover:bg-[#d3e5ff]">
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
