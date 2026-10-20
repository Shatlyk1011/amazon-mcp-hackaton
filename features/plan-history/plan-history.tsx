"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import type { SavedPlan } from "@/lib/plans/types";
import { readPlanHistory } from "./storage";

export function PlanHistory() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const ids = readPlanHistory();
    void Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`/api/plans/${id}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status === 404) return null;
          if (!response.ok) throw new Error("Could not load plan");
          const data = await response.json();
          if (
            data.plan?.id !== id ||
            typeof data.plan.input?.origin !== "string" ||
            typeof data.plan.input?.destination !== "string"
          )
            throw new Error("Invalid plan");
          return data.plan as SavedPlan;
        } catch {
          if (!controller.signal.aborted) setUnavailable(true);
          return null;
        }
      }),
    ).then((results) => {
      if (!controller.signal.aborted)
        setPlans(results.filter((plan): plan is SavedPlan => plan !== null));
    });
    return () => controller.abort();
  }, []);

  if (!plans.length && !unavailable) return null;
  return (
    <section
      aria-labelledby="plan-history-title"
      className="rounded-xl border border-[#ebebeb] bg-white p-5"
    >
      <h2
        id="plan-history-title"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <History className="size-4" aria-hidden="true" /> Previous plans
      </h2>
      <div className="mt-3 flex flex-col">
        {plans.map((plan) => (
          <Link
            key={plan.id}
            href={`/dashboard/${plan.id}`}
            className="flex min-h-12 items-center justify-between gap-3 border-t border-[#ebebeb] py-3 text-sm font-medium hover:underline"
          >
            <span>
              {plan.input.origin} → {plan.input.destination}
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        ))}
      </div>
      {unavailable ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Some saved plans could not be loaded. Please try again later.
        </p>
      ) : null}
    </section>
  );
}
