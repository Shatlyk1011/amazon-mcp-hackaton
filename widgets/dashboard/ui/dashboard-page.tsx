"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CircleDollarSign,
  Clock3,
  Menu,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  calculateBudget,
  demoAlone,
  demoFamily,
  housing,
  movers,
  recommendations,
  type RelocationInput,
} from "@/lib/relocation";
import { money } from "@/shared/lib/format";
import {
  DashboardNav,
  DashboardSidebar,
} from "@/widgets/dashboard/ui/dashboard-sidebar";
import { RouteMap } from "@/entities/relocation/ui/route-map";
import { HousingPanel } from "@/widgets/dashboard/ui/housing-panel";
import { BudgetPanel } from "@/widgets/dashboard/ui/budget-panel";
import { MoverPanel } from "@/widgets/dashboard/ui/mover-panel";
import { McpExplorer, type Trace } from "@/widgets/dashboard/ui/mcp-explorer";
import type { RouteResult } from "@/lib/providers/mapbox";
export function DashboardPage({
  input,
  traces,
  route,
  onSwitchScenario,
}: {
  input: RelocationInput;
  traces: Trace[];
  route: RouteResult | null;
  onSwitchScenario: (input: RelocationInput) => void;
}) {
  const [tab, setTab] = useState("Overview");
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
    [input, selectedHousing, selectedMover],
  );
  const nav = <DashboardSidebar active={tab} onChange={setTab} />;
  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#292827] dark:bg-[#0e0c1f] dark:text-white">
      <div className="flex min-h-screen">
        {nav}
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#e8e4dd] bg-white/90 px-5 py-4 backdrop-blur dark:border-[#3f3a52] dark:bg-[#1b1938]/90 lg:px-8">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Open navigation"
                    >
                      <Menu className="size-4" />
                    </Button>
                  }
                />
                <SheetContent
                  side="left"
                  className="border-[#3f3a52] bg-[#1b1938] text-white"
                >
                  <SheetHeader>
                    <SheetTitle className="text-white">MoveFlow</SheetTitle>
                  </SheetHeader>
                  <div className="pt-4">
                    <DashboardNav active={tab} onChange={setTab} />
                  </div>
                </SheetContent>
              </Sheet>
              <div>
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#73706d] dark:text-[#bcbac9]">
                  YOUR RELOCATION PLAN
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
                className="border-[#e8e4dd] bg-white dark:border-[#3f3a52] dark:bg-[#1b1938]"
              >
                {isDark ? <Sun /> : <Moon />}
              </Button>
              <Button className="hidden bg-[#1b1938] px-4 text-sm font-semibold text-white hover:bg-[#0e0c1f] dark:bg-[#c9b4fa] dark:text-[#1b1938] dark:hover:bg-[#bda2f2] sm:inline-flex">
                <Bot data-icon="inline-start" /> Ask MoveFlow
              </Button>
            </div>
          </header>
          <div className="mx-auto max-w-[1500px] p-5 lg:p-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-[#1b1938] px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base font-semibold leading-5 tracking-tight">
                    Your moving plan
                  </h1>
                  <Badge className="bg-[#c9b4fa] text-[#1b1938]">
                    Plan ready
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-4 text-white/75">
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
                className="bg-[#c9b4fa] px-3 font-semibold text-[#1b1938] hover:bg-[#bda2f2]"
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
                  className="gap-0 rounded-lg bg-white py-0 dark:bg-[#1b1938]"
                >
                  <CardContent className="flex items-center gap-2.5 px-3 py-2.5">
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#73706d] dark:text-[#bcbac9]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs leading-4 text-[#73706d] dark:text-[#bcbac9]">
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
              <RouteMap route={route} />
              <Card className="rounded-xl bg-white shadow-[0_1px_3px_rgba(41,40,39,0.08)] dark:bg-[#1b1938]">
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#73706d] dark:text-[#bcbac9]">
                      Suggested path
                    </div>
                    <CardTitle className="mt-2">
                      {recs[1]?.label} · {recs[1]?.transport}
                    </CardTitle>
                  </div>
                  <Sparkles className="size-5 text-[#155555] dark:text-[#c9b4fa]" />
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
                  <Button className="mt-6 w-full bg-[#1b1938] text-white hover:bg-[#0e0c1f] dark:bg-[#c9b4fa] dark:text-[#1b1938] dark:hover:bg-[#bda2f2]">
                    Use this strategy <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="mt-8">
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
                        ? "border-[#155555] bg-[#f4f8f6] dark:border-[#3f8b83] dark:bg-[#173638]"
                        : undefined
                    }
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{recommendation.label}</CardTitle>
                        {index === 1 && (
                          <Badge className="bg-[#155555] text-white hover:bg-[#155555]">
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
            <div className="mt-8 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
              <HousingPanel
                selected={selectedHousing}
                onSelect={setSelectedHousing}
              />
              <BudgetPanel budget={budget} input={input} />
            </div>
            <MoverPanel selected={selectedMover} onSelect={setSelectedMover} />
            <McpExplorer traces={traces} />
          </div>
        </section>
      </div>
    </main>
  );
}
