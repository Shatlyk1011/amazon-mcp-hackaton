"use client";

import { useState } from "react";
import { ArrowRight, Home, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { demoAlone, demoFamily, type RelocationInput } from "@/lib/relocation";

export function OnboardingDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (input: RelocationInput) => void;
}) {
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState<"alone" | "family">("family");
  const [origin, setOrigin] = useState("Boston, MA");
  const [destination, setDestination] = useState("New York, NY");
  const [budget, setBudget] = useState(8000);
  const finish = () =>
    onDone(
      scenario === "family"
        ? { ...demoFamily, origin, destination, budget }
        : { ...demoAlone, origin, destination, budget },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="px-6 pt-6 pr-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of 3
          </div>
          <DialogTitle className="mt-2 text-2xl">
            {step === 0
              ? "Where are you headed?"
              : step === 1
                ? "Who is moving?"
                : "Your moving profile"}
          </DialogTitle>
          <DialogDescription>
            Build a relocation plan with routes, housing, services, and a
            transparent budget.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="px-6 pb-6 pt-0">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                From
                <Input
                  value={origin}
                  onChange={(event) => setOrigin(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                To
                <Input
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Moving date
                <Input type="date" defaultValue="2026-11-15" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Total budget
                <Input
                  type="number"
                  value={budget}
                  onChange={(event) => setBudget(Number(event.target.value))}
                />
              </label>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant={scenario === "alone" ? "secondary" : "outline"}
                className="h-auto justify-start p-5 text-left"
                onClick={() => setScenario("alone")}
              >
                <span>
                  <Users className="mb-8" />
                  <strong className="block">Moving alone</strong>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    Light luggage, flexible and efficient.
                  </span>
                </span>
              </Button>
              <Button
                variant={scenario === "family" ? "secondary" : "outline"}
                className="h-auto justify-start p-5 text-left"
                onClick={() => setScenario("family")}
              >
                <span>
                  <Home className="mb-8" />
                  <strong className="block">Moving with family</strong>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    People, pets, and furniture included.
                  </span>
                </span>
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted p-4">
                <div className="text-xs text-muted-foreground">TRANSPORT</div>
                <div className="mt-2 font-semibold">Compare drive and fly</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  We&apos;ll model both routes in your budget.
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <div className="text-xs text-muted-foreground">HOUSING</div>
                <div className="mt-2 font-semibold">Find a new home</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Demo listings are clearly labeled.
                </p>
              </div>
            </div>
          )}
          <div className="mt-8 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)}>
                Continue <ArrowRight data-icon="inline-end" />
              </Button>
            ) : (
              <Button onClick={finish}>
                Create my moving plan <ArrowRight data-icon="inline-end" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
