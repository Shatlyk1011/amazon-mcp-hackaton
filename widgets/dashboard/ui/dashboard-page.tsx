"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Clock3,
  Moon,
  Route,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateBudget,
  demoAlone,
  demoFamily,
  movers,
  recommendations,
  type Housing,
  type RelocationInput,
} from "@/lib/relocation";
import { money } from "@/shared/lib/format";
import { RouteMap } from "@/entities/relocation/ui/route-map";
import { HousingMap } from "@/entities/relocation/ui/housing-map";
import { HousingPanel } from "@/widgets/dashboard/ui/housing-panel";
import { BudgetPanel } from "@/widgets/dashboard/ui/budget-panel";
import { MoverPanel } from "@/widgets/dashboard/ui/mover-panel";
import { McpExplorer, type Trace } from "@/widgets/dashboard/ui/mcp-explorer";
import type { RouteResult } from "@/lib/providers/mapbox";

function ToolSource({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] font-medium text-[#4d4d4d] dark:text-[#a1a1a1]">
      <span className="size-1.5 rounded-full bg-[#0070f3] dark:bg-[#50e3c2]" />
      MCP TOOL
      <code className="rounded bg-[#f2f2f2] px-1.5 py-0.5 text-[#171717] dark:bg-white/10 dark:text-white">
        {tool}
      </code>
    </div>
  );
}

export function DashboardPage({
  input,
  traces,
  route,
  housing = [],
  housingBrowseUrl = "https://www.zillow.com/",
  onSwitchScenario,
}: {
  input: RelocationInput;
  traces: Trace[];
  route: RouteResult | null;
  housing?: Housing[];
  housingBrowseUrl?: string;
  onSwitchScenario: (input: RelocationInput) => void;
}) {
  const [selectedHousing, setSelectedHousing] = useState<string | null>(null);
  const [selectedMover, setSelectedMover] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("moveflow-theme");
      const next = stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(next);
      document.documentElement.classList.toggle("dark", next);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("moveflow-theme", next ? "dark" : "light");
  }
  const recs = useMemo(() => recommendations(input), [input]);
  const budget = useMemo(
    () =>
      calculateBudget(
        input,
        housing.find((item) => item.id === selectedHousing),
        movers.find((item) => item.id === selectedMover),
      ),
    [input, housing, selectedHousing, selectedMover],
  );
  return (
    <main className="min-h-screen bg-[#fafafa] text-[#171717] dark:bg-[#171717] dark:text-white">
      <section className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#ebebeb] bg-[#fafafa]/90 px-5 py-4 backdrop-blur dark:border-[#4d4d4d] dark:bg-[#171717]/90 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-[#171717] text-sm font-semibold text-white dark:bg-white dark:text-[#171717]">
              M
            </div>
            <div>
              <div className="font-mono text-[11px] font-medium tracking-normal text-[#4d4d4d] dark:text-[#a1a1a1]">
                MOVEFLOW · YOUR RELOCATION PLAN
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
                {input.origin}{" "}
                <ArrowRight className="size-4 text-muted-foreground" />{" "}
                {input.destination}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={
                isDark ? "Switch to light mode" : "Switch to dark mode"
              }
              onClick={toggleTheme}
              className="border-[#ebebeb] bg-white dark:border-[#4d4d4d] dark:bg-[#171717]"
            >
              {isDark ? <Sun /> : <Moon />}
            </Button>
            <Button className="hidden rounded-md bg-[#171717] px-4 text-sm font-medium text-white hover:bg-[#171717]/85 dark:bg-white dark:text-[#171717] dark:hover:bg-white/85 sm:inline-flex">
              <Bot data-icon="inline-start" /> Ask MoveFlow
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-[#ebebeb] bg-white px-4 py-3 text-[#171717] dark:border-[#4d4d4d] dark:bg-[#171717] dark:text-white">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-semibold leading-5 tracking-tight">
                  Your moving plan
                </h1>
                <Badge className="bg-[#d3e5ff] text-[#0761d1] hover:bg-[#d3e5ff]">
                  Plan ready
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-4 text-[#4d4d4d] dark:text-white/75">
                {input.scenario === "family" ? "Family move" : "Solo move"}
                {input.pets > 0 &&
                  ` · ${input.pets} ${input.pets === 1 ? "pet" : "pets"}`}
                {" · "}
                {input.furniture ? "Furniture" : "Light luggage"}
                {" · Demo sources"}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                onSwitchScenario(
                  input.scenario === "family" ? demoAlone : demoFamily,
                )
              }
              className="bg-[#171717] px-3 font-medium text-white hover:bg-[#171717]/85 dark:bg-white dark:text-[#171717] dark:hover:bg-white/85"
            >
              Switch demo scenario <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [
                "Moving date",
                new Date(input.movingDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
                Clock3,
              ],
              [
                "Travel distance",
                route ? `${route.distanceMiles} mi` : "—",
                Route,
              ],
              ["Your budget", money(input.budget), CircleDollarSign],
              [
                "People moving",
                `${input.adults + input.children} ${input.adults + input.children === 1 ? "person" : "people"}`,
                Users,
              ],
            ].map(([label, value, Icon]) => (
              <Card
                key={label as string}
                size="sm"
                className="gap-0 rounded-lg bg-white py-0 ring-[#ebebeb] dark:bg-[#171717] dark:ring-[#4d4d4d]"
              >
                <CardContent className="flex items-center gap-2.5 px-3 py-2.5">
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-[#4d4d4d] dark:text-[#a1a1a1]"
                  />
                  <div className="min-w-0">
                    <div className="text-xs leading-4 text-[#4d4d4d] dark:text-[#a1a1a1]">
                      {label as string}
                    </div>
                    <div className="mt-0.5 text-base font-semibold leading-5 tracking-tight tabular-nums">
                      {value as string}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-5">
            <div className="space-y-2">
              <ToolSource tool="calculate_route" />
              <RouteMap route={route} />
            </div>
            <div className="space-y-2">
              <ToolSource tool="search_housing" />
              <HousingMap listings={housing} onSelect={setSelectedHousing} />
              <HousingPanel
                items={housing}
                browseUrl={housingBrowseUrl}
                selected={selectedHousing}
                onSelect={setSelectedHousing}
              />
            </div>
            <div className="space-y-2">
              <ToolSource tool="recommend_moving_strategy" />
              <Card className="rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb] dark:bg-[#171717] dark:ring-[#4d4d4d]">
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <div className="font-mono text-[11px] font-medium uppercase tracking-normal text-[#4d4d4d] dark:text-[#a1a1a1]">
                      Suggested path
                    </div>
                    <CardTitle className="mt-2">
                      {recs[1]?.label} · {recs[1]?.transport}
                    </CardTitle>
                  </div>
                  <Sparkles className="size-5 text-[#0070f3]" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {recs[1]?.explanation}
                  </p>
                  <div className="my-5 h-px bg-border" />
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        ESTIMATED MOVE COST
                      </div>
                      <div className="mt-1 text-3xl font-semibold">
                        {money(recs[1]?.cost ?? 0)}
                      </div>
                    </div>
                    <Badge variant="secondary">Within budget</Badge>
                  </div>
                  <Button className="mt-6 w-full rounded-md bg-[#171717] text-white hover:bg-[#171717]/85 dark:bg-white dark:text-[#171717] dark:hover:bg-white/85">
                    Use this strategy <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="mt-8 space-y-2">
            <ToolSource tool="recommend_moving_strategy" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Strategy options
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Three ways to get there, with the tradeoffs made clear.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {recs.map((recommendation, index) => (
                  <Card
                    key={recommendation.id}
                    className={
                      index === 1
                        ? "border-[#0070f3] bg-[#d3e5ff]/35 ring-[#0070f3]/20 dark:border-[#50e3c2] dark:bg-[#171717]"
                        : undefined
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{recommendation.label}</CardTitle>
                        {index === 1 && (
                          <Badge className="bg-[#0070f3] text-white hover:bg-[#0761d1]">
                            BEST FIT
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold">
                        {money(recommendation.cost)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {recommendation.transport} · {recommendation.service}
                      </div>
                      <p className="mt-4 min-h-12 text-sm leading-5 text-muted-foreground">
                        {recommendation.explanation}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {recommendation.advantages.map((advantage) => (
                          <Badge key={advantage} variant="secondary">
                            + {advantage}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-2">
              <ToolSource tool="calculate_budget" />
              <BudgetPanel budget={budget} input={input} />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <ToolSource tool="search_moving_services" />
            <MoverPanel selected={selectedMover} onSelect={setSelectedMover} />
          </div>
          <div className="mt-5 space-y-2">
            <ToolSource tool="create_relocation_plan" />
            <McpExplorer traces={traces} />
          </div>
        </div>
      </section>
    </main>
  );
}
