"use client";
import { ArrowRight, Compass } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoAlone, demoFamily, type RelocationInput } from "@/lib/relocation";

export function LandingPage({
  onSubmit,
}: {
  onSubmit: (input: RelocationInput) => void;
}) {
  const [scenario, setScenario] = useState<"alone" | "family">("family");
  const [origin, setOrigin] = useState("Boston, MA");
  const [destination, setDestination] = useState("New York, NY");
  const [movingDate, setMovingDate] = useState("2026-11-15");
  const [budget, setBudget] = useState(8000);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const defaults = scenario === "family" ? demoFamily : demoAlone;
    onSubmit({ ...defaults, origin, destination, movingDate, budget });
  }

  return (
    <main className="min-h-screen bg-[#1b1938] text-white">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-[#c9b4fa] text-[#1b1938]">
            <Compass className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            MoveFlow
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-12 px-6 pb-20 pt-14 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:pb-28 lg:pt-24">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c9b4fa]">
            Relocation planning, made clear
          </p>
          <h1 className="mt-5 max-w-lg text-5xl font-medium leading-[0.96] tracking-[-0.04em] sm:text-6xl">
            A calmer way to move forward.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
            Tell us where you&apos;re going and we&apos;ll build a practical
            plan for your route, home, movers, and budget.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-6 text-[#292827] shadow-2xl sm:p-8"
        >
          <div className="mb-7">
            <h2 className="text-2xl font-medium tracking-tight">
              Start with the basics
            </h2>
            <p className="mt-2 text-sm text-[#73706d]">
              You can refine the details in your plan.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Moving from
              <Input
                value={origin}
                onChange={(event) => setOrigin(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Moving to
              <Input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Moving date
              <Input
                type="date"
                value={movingDate}
                onChange={(event) => setMovingDate(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Total budget
              <Input
                type="number"
                min="0"
                step="100"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
                required
              />
            </label>
          </div>
          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">Who is moving?</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["alone", "family"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScenario(option)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${scenario === option ? "border-[#1b1938] bg-[#1b1938] text-white" : "border-[#e8e4dd] bg-white text-[#292827] hover:border-[#1b1938]"}`}
                >
                  {option === "alone" ? "Moving alone" : "Moving with family"}
                </button>
              ))}
            </div>
          </fieldset>
          <Button
            type="submit"
            className="mt-7 h-12 w-full bg-[#1b1938] text-base font-bold text-white hover:bg-[#0e0c1f]"
          >
            Create my moving plan <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </div>
    </main>
  );
}
