"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
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
  recommendations,
  type Housing,
  type Mover,
  type RelocationInput,
} from "@/lib/relocation";
import { money } from "@/shared/lib/format";
import { RouteMap } from "@/entities/relocation/ui/route-map";
import { HousingMap } from "@/entities/relocation/ui/housing-map";
import { HousingPanel } from "@/widgets/dashboard/ui/housing-panel";
import type { HousingFilters } from "@/widgets/dashboard/ui/housing-panel";
import { BudgetPanel } from "@/widgets/dashboard/ui/budget-panel";
import { MoverPanel } from "@/widgets/dashboard/ui/mover-panel";
import { McpActivity, type Trace } from "@/widgets/dashboard/ui/mcp-explorer";
import type { RouteResult } from "@/lib/providers/mapbox";

function ToolSource({ tool }: { tool: string }) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs font-medium text-[#4d4d4d] dark:text-[#a1a1a1]">
      <span className="size-2 rounded-full bg-[#0070f3] dark:bg-[#50e3c2]" />
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
  movers = [],
  housingBrowseUrl = "https://www.zillow.com/",
  movingServicesSource,
  movingServicesWarning,
  onSwitchScenario,
}: {
  input: RelocationInput;
  traces: Trace[];
  route: RouteResult | null;
  housing?: Housing[];
    movers?: Mover[];
  housingBrowseUrl?: string;
    movingServicesSource?: string;
    movingServicesWarning?: string;
  onSwitchScenario: (input: RelocationInput) => void;
}) {
  const [selectedHousing, setSelectedHousing] = useState<string | null>(null);
  const [selectedMover, setSelectedMover] = useState<string | null>(null);
  const [housingFilters, setHousingFilters] = useState<HousingFilters>({
    minRent: "",
    maxRent: "",
    minBedrooms: "",
    minBathrooms: "",
  });
  const [appliedHousingFilters, setAppliedHousingFilters] =
    useState<HousingFilters>(housingFilters);
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
  useEffect(() => {
    const timeout = window.setTimeout(
      () => setAppliedHousingFilters(housingFilters),
      500,
    );
    return () => window.clearTimeout(timeout);
  }, [housingFilters]);
  const recs = useMemo(() => recommendations(input), [input]);
  const budget = useMemo(
    () =>
      calculateBudget(
        input,
        housing.find((item) => item.id === selectedHousing),
      ),
    [input, housing, selectedHousing],
  );
  const filteredHousing = useMemo(() => {
    const minRent = Number(appliedHousingFilters.minRent);
    const maxRent = Number(appliedHousingFilters.maxRent);
    const minBedrooms = Number(appliedHousingFilters.minBedrooms);
    const minBathrooms = Number(appliedHousingFilters.minBathrooms);

    return housing.filter((listing) => {
      if (appliedHousingFilters.minRent && listing.monthlyRent < minRent)
        return false;
      if (appliedHousingFilters.maxRent && listing.monthlyRent > maxRent)
        return false;
      if (appliedHousingFilters.minBedrooms && listing.bedrooms < minBedrooms)
        return false;
      if (
        appliedHousingFilters.minBathrooms &&
        listing.bathrooms < minBathrooms
      )
        return false;
      return true;
    });
  }, [housing, appliedHousingFilters]);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="min-w-0">
        <header className="sticky top-0 z-20 mx-auto flex max-w-[1440px] items-center justify-between gap-4 border-b border-[#ebebeb] bg-[#fafafa]/90 px-5 py-4 backdrop-blur dark:border-[#4d4d4d] dark:bg-[#171717]/90 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[#171717] text-sm font-semibold text-white dark:bg-white dark:text-[#171717]">
              M
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-medium tracking-normal text-[#4d4d4d] dark:text-[#a1a1a1]">
                MOVEFLOW · YOUR RELOCATION PLAN
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-base sm:text-lg font-semibold tracking-[-0.02em]">
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
          </div>
        </header>
        <div className="mx-auto grid max-w-[1440px] items-start gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:py-10">
          <aside
            aria-label="MCP server activity"
            className="min-w-0 lg:sticky lg:top-32"
          >
            <div className="hidden lg:block">
              <McpActivity traces={traces} />
            </div>
            <details className="group rounded-xl border border-border bg-card p-4 lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
                MCP server activity
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{traces.length} calls</Badge>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                  />
                </span>
              </summary>
              <div className="pt-4">
                <McpActivity traces={traces} />
              </div>
            </details>
          </aside>
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-[#ebebeb] bg-white p-6 text-[#171717] dark:border-[#4d4d4d] dark:bg-[#171717] dark:text-white">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold leading-8 tracking-tight">
                    Your moving plan
                  </h1>
                  <Badge className="bg-[#d3e5ff] text-[#0761d1] hover:bg-[#d3e5ff]">
                    Plan ready
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#4d4d4d] dark:text-white/75">
                  {input.scenario === "family" ? "Family move" : "Solo move"}
                  {input.pets > 0 &&
                    ` · ${input.pets} ${input.pets === 1 ? "pet" : "pets"}`}
                  {" · "}
                  {input.furniture ? "Furniture" : "Light luggage"}
                  {" · Provider sources"}
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
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
                  <CardContent className="flex items-center gap-3 px-4 py-5">
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#4d4d4d] dark:text-[#a1a1a1]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs leading-4 text-[#4d4d4d] dark:text-[#a1a1a1]">
                        {label as string}
                      </div>
                      <div className="mt-1 text-xl font-semibold leading-7 tracking-tight tabular-nums">
                        {value as string}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-10">
              <div className="flex flex-col gap-4">
                <ToolSource tool="calculate_route" />
                <RouteMap route={route} />
              </div>
              <div className="flex flex-col gap-4">
                <ToolSource tool="search_housing" />
                <HousingMap
                  listings={filteredHousing}
                  onSelect={setSelectedHousing}
                />
                <HousingPanel
                  key={`${JSON.stringify(appliedHousingFilters)}:${filteredHousing.map((listing) => listing.id).join(",")}`}
                  items={filteredHousing}
                  totalItems={housing.length}
                  browseUrl={housingBrowseUrl}
                  selected={selectedHousing}
                  onSelect={setSelectedHousing}
                  filters={housingFilters}
                  onFiltersChange={setHousingFilters}
                />
              </div>
              <div className="flex flex-col gap-4">
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
            <div className="mt-10 flex flex-col gap-4">
              <ToolSource tool="recommend_moving_strategy" />
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">
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
                        <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="mt-10 grid gap-6">
              <div className="flex flex-col gap-4">
                <ToolSource tool="calculate_budget" />
                <BudgetPanel budget={budget} input={input} />
              </div>
            </div>
            <div className="mt-10 flex flex-col gap-4">
              <ToolSource tool="search_moving_services" />
              <MoverPanel
                movers={movers}
                selected={selectedMover}
                onSelect={setSelectedMover}
                source={movingServicesSource}
                warning={movingServicesWarning}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
