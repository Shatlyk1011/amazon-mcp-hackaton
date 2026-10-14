"use client";
import { useState } from "react";
import { DashboardPage } from "@/widgets/dashboard/ui/dashboard-page";
import { LandingPage } from "@/widgets/landing/ui/landing-page";
import type { Trace } from "@/widgets/dashboard/ui/mcp-explorer";
import type { RelocationInput } from "@/lib/relocation";
import type { RouteResult } from "@/lib/providers/mapbox";
export default function Home() {
  const [input, setInput] = useState<RelocationInput | null>(null);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [route, setRoute] = useState<RouteResult | null>(null);
  async function runPlan(nextInput: RelocationInput) {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: nextInput }),
    });
    const data = await response.json();
    setInput(nextInput);
    setRoute(data.route);
    setTraces(data.traces);
  }
  return input ? (
    <DashboardPage
      input={input}
      route={route}
      traces={traces}
      onSwitchScenario={runPlan}
    />
  ) : (
    <LandingPage onSubmit={runPlan} />
  );
}
