"use client";
import { ArrowRight, Check, Compass } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { Input } from "@/components/ui/input";
import { demoAlone, demoFamily, type RelocationInput } from "@/lib/relocation";

export function LandingPage({
  onSubmit,
}: {
  onSubmit: (input: RelocationInput) => void;
}) {
  const [scenario, setScenario] = useState<"alone" | "family">("family");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [movingDate, setMovingDate] = useState("2026-11-15");
  const [budget, setBudget] = useState(8000);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const defaults = scenario === "family" ? demoFamily : demoAlone;
    onSubmit({ ...defaults, origin, destination, movingDate, budget });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#fafafa] text-[#171717]">
      <header className="mx-auto flex max-w-6xl items-center border-b border-[#ebebeb] px-6 py-5 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-md bg-[#171717] text-white">
            <Compass className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-[-0.02em]">
            MoveFlow
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-10 lg:pb-32 lg:pt-28">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-normal text-[#4d4d4d]">
            Relocation planning, made clear
          </p>
          <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-none tracking-[-0.05em] sm:text-6xl">
            A calmer way to move forward.
          </h1>
          <p className="mt-6 max-w-md text-base leading-6 text-[#4d4d4d]">
            Tell us where you&apos;re going and we&apos;ll build a practical
            plan for your route, home, movers, and budget.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-[#ebebeb] bg-white p-6 text-[#171717] shadow-[0_1px_1px_rgba(0,0,0,0.04)] sm:p-8"
        >
          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-[-0.04em]">
              Start with the basics
            </h2>
            <p className="mt-2 text-sm text-[#4d4d4d]">
              You can refine the details in your plan.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Moving from
              <CityAutocomplete
                value={origin}
                onChange={setOrigin}
                placeholder="Select City"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Moving to
              <CityAutocomplete
                value={destination}
                onChange={setDestination}
                placeholder="Select Destination"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Moving date
              <Input
                className="h-10 rounded-md bg-white px-3 text-sm"
                type="date"
                value={movingDate}
                onChange={(event) => setMovingDate(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Total budget
              <Input
                className="h-10 rounded-md bg-white px-3 text-sm"
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
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-3 text-left text-sm font-medium transition",
                    scenario === option
                      ? "border-[#171717] bg-[#171717] text-white"
                      : "border-[#ebebeb] bg-white text-[#171717] hover:border-[#171717]",
                  )}
                >
                  <input
                    checked={scenario === option}
                    className="sr-only"
                    name="moving-scenario"
                    type="radio"
                    value={option}
                    onChange={() => setScenario(option)}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-sm border",
                      scenario === option
                        ? "border-white bg-white text-[#171717]"
                        : "border-[#73706d]",
                    )}
                  >
                    {scenario === option && <Check className="size-3" />}
                  </span>
                  {option === "alone" ? "Moving alone" : "Moving with family"}
                </label>
              ))}
            </div>
          </fieldset>
          <Button
            type="submit"
            className="mt-7 h-11 w-full rounded-full bg-[#171717] px-4 text-base font-medium text-white hover:bg-[#171717]/85"
          >
            Create my moving plan <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </div>
    </main>
  );
}
