"use client";
import { useState } from "react";
import { DashboardPage } from "@/widgets/dashboard/ui/dashboard-page";
import { LandingPage } from "@/widgets/landing/ui/landing-page";
import type { Trace } from "@/widgets/dashboard/ui/mcp-explorer";
import type { Housing, Mover, RelocationInput } from "@/lib/relocation";
import type { RouteResult } from "@/lib/providers/mapbox";
export default function Home() {
  const [input, setInput] = useState<RelocationInput | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [housing, setHousing] = useState<Housing[]>([]);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [movingServicesSource, setMovingServicesSource] = useState("");
  const [movingServicesWarning, setMovingServicesWarning] = useState<string>();
  const [housingBrowseUrl, setHousingBrowseUrl] = useState(
    "https://www.zillow.com/",
  );
  async function runPlan(nextInput: RelocationInput) {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: nextInput }),
    });
    const data = await response.json();
    setInput(nextInput);
    setRoute(data.route);
    setHousing(data.housing ?? []);
    setMovers(data.movers ?? []);
    setMovingServicesSource(data.movingServicesSource ?? "TomTom Search API");
    setMovingServicesWarning(data.movingServicesWarning);
    setHousingBrowseUrl(data.housingBrowseUrl ?? "https://www.zillow.com/");
    setTraces(data.traces);
  }
  return input ? (
    <DashboardPage
      input={input}
      route={route}
      housing={housing}
      movers={movers}
      housingBrowseUrl={housingBrowseUrl}
      movingServicesSource={movingServicesSource}
      movingServicesWarning={movingServicesWarning}
      traces={traces}
      onSwitchScenario={runPlan}
    />
  ) : (
    <LandingPage onSubmit={runPlan} />
  );
}
