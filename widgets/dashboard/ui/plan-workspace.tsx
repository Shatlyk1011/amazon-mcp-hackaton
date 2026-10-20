"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ListChecks, LoaderCircle, Sparkles } from "lucide-react";
import { DashboardPage } from "./dashboard-page";
import { VoicePlanRecorder } from "@/features/voice-plan/ui/voice-plan-recorder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PlanRequest, SavedPlan } from "@/lib/plans/types";

export function PlanWorkspace({
  initialPlan,
  initialRequests,
}: {
  initialPlan: SavedPlan;
  initialRequests: PlanRequest[];
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [requests, setRequests] = useState(initialRequests);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [isRefinementOpen, setRefinementOpen] = useState(false);
  const active = useRef(false);
  const messageAttempt = useRef<{ message: string; id: string } | null>(null);

  async function send(path: string, body: unknown, method = "POST") {
    if (active.current) return false;
    active.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/plans/${plan.id}${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request failed.");
      setPlan(data.plan);
      if (data.requests) setRequests(data.requests);
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "The request failed.");
      // Reconcile if a response was lost after a successful write.
      try {
        const response = await fetch(`/api/plans/${plan.id}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const data = await response.json();
          setPlan(data.plan);
          setRequests(data.requests);
          if (
            path === "/messages" &&
            data.requests.some(
              (item: PlanRequest) =>
                item.id === messageAttempt.current?.id &&
                item.status !== "running",
            )
          ) {
            setError(undefined);
            return true;
          }
        }
      } catch {
        /* Keep the last known saved state visible. */
      }
      return false;
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function submitMessage(rawMessage: string) {
    const text = rawMessage.trim();
    if (!text || busy || active.current) return false;
    if (messageAttempt.current?.message !== text)
      messageAttempt.current = {
        message: text,
        id: crypto.randomUUID(),
      };
    if (
      await send("/messages", {
        message: text,
        requestId: messageAttempt.current.id,
      })
    ) {
      setMessage("");
      messageAttempt.current = null;
      return true;
    }
    return false;
  }

  const refinementPanel = (
    <Card className="rounded-xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Refine this plan</CardTitle>
          <Badge variant="secondary">Saved · Version {plan.version}</Badge>
        </div>
        <CardDescription>
          Ask naturally about your move. The assistant uses your saved plan and
          MCP tools, then keeps the conversation here for your return.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <VoicePlanRecorder
          compact
          pending={busy}
          onSubmit={async (prompt) => {
            const sent = await submitMessage(prompt);
            if (sent) setRefinementOpen(false);
          }}
          idleHeading="Tell us what to change"
          description="Speak a question or change. We’ll apply it to this saved move plan."
          textareaPlaceholder="Find a lower-cost mover, move the date to June, or explain what I should do next…"
          submitLabel="Send request"
        />
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await submitMessage(message);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="plan-request">
                Request a change or ask a question
              </FieldLabel>
              <Textarea
                id="plan-request"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Lower my monthly rent limit to $1,800 and find new options."
                maxLength={4000}
                disabled={busy}
                required
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <p role="status" className="text-sm text-muted-foreground">
                {busy
                  ? "Working on your plan…"
                  : "Changes apply to this move only."}
              </p>
              <Button type="submit" disabled={busy || !message.trim()}>
                {busy ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <ArrowUp data-icon="inline-start" />
                )}
                Send request
              </Button>
            </div>
          </FieldGroup>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Edit plan details directly
          </summary>
          <form
            key={plan.version}
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void send(
                "",
                {
                  action: "requirements",
                  version: plan.version,
                  changes: {
                    origin: form.get("origin"),
                    destination: form.get("destination"),
                    movingDate: form.get("movingDate"),
                    budget: Number(form.get("budget")),
                    maxRent: Number(form.get("maxRent")),
                    minBedrooms: Number(form.get("minBedrooms")),
                  },
                },
                "PATCH",
              );
            }}
          >
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { name: "origin", label: "Moving from", type: "text" },
                  { name: "destination", label: "Moving to", type: "text" },
                  { name: "movingDate", label: "Moving date", type: "date" },
                  {
                    name: "budget",
                    label: "Total moving budget ($)",
                    type: "number",
                  },
                  {
                    name: "maxRent",
                    label: "Monthly rent limit ($)",
                    type: "number",
                  },
                  {
                    name: "minBedrooms",
                    label: "Minimum bedrooms",
                    type: "number",
                  },
                ] as const
              ).map((field) => (
                <Field key={field.name}>
                  <FieldLabel htmlFor={`edit-${field.name}`}>
                    {field.label}
                  </FieldLabel>
                  <Input
                    id={`edit-${field.name}`}
                    name={field.name}
                    type={field.type}
                    min={field.type === "number" ? 0 : undefined}
                    defaultValue={plan.input[field.name]}
                    required
                    disabled={busy}
                  />
                </Field>
              ))}
              <Button type="submit" disabled={busy}>
                Save details and refresh results
              </Button>
            </FieldGroup>
          </form>
        </details>
        {requests.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Request history ({requests.length})
            </summary>
            <ol
              className="mt-4 flex flex-col gap-4"
              aria-label="Plan request history"
            >
              {requests.slice(-6).map((item) => (
                <li key={item.id} className="border-l-2 border-border pl-4">
                  <div className="flex items-center gap-2">
                    <p className="whitespace-pre-wrap break-words text-sm font-medium">
                      {item.message}
                    </p>
                    <Badge
                      variant={
                        item.status === "failed" ? "destructive" : "outline"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                    {item.reply ||
                      "This request has not finished. Reload to check its result."}
                  </p>
                  {item.tools.length > 0 && (
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      {item.tools
                        .map(
                          (tool) =>
                            `${tool.tool}${tool.status === "error" ? " (failed)" : ""}`,
                        )
                        .join(" → ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </details>
        )}
      </CardContent>
      <CardFooter>
        <p className="break-all font-mono text-xs text-muted-foreground">
          Plan {plan.id}
        </p>
      </CardFooter>
    </Card>
  );

  const controls = (
    <Dialog open={isRefinementOpen} onOpenChange={setRefinementOpen}>
      <DialogTrigger
        render={
          <Button size="lg" className="rounded-full px-5 shadow-lg">
            <Sparkles data-icon="inline-start" />
            Refine this plan
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-12">
          <DialogTitle className="text-xl">Refine this plan</DialogTitle>
          <DialogDescription>
            Ask a question, make a change, or review your previous requests.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pt-5">
          <Card size="sm" className="gap-0 bg-muted/40 py-0">
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-xs sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Route</span>
                <span className="font-medium">
                  {plan.input.origin} → {plan.input.destination}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Moving date</span>
                <span className="font-medium">{plan.input.movingDate}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Budget</span>
                <span className="font-medium">
                  ${plan.input.budget.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">Plan version</span>
                <span className="font-medium">Version {plan.version}</span>
              </div>
            </CardContent>
          </Card>
        </div>
        <ScrollArea className="max-h-[calc(100vh-19rem)] px-6 pb-6 pt-5">
          {refinementPanel}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  if (!plan.result)
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
        <h1 className="text-2xl font-semibold">Your moving plan</h1>
        <Alert>
          <AlertDescription>
            {plan.error ||
              "Your plan was saved, but its results are not ready yet."}
          </AlertDescription>
        </Alert>
        <Button disabled={busy} onClick={() => void send("/retry", {})}>
          {busy ? "Generating…" : "Generate plan results"}
        </Button>
        {controls}
        <Link href="/" className="underline">
          Start another move
        </Link>
      </main>
    );

  return (
    <DashboardPage
      referenceDate={plan.result.generatedAt.slice(0, 10)}
      input={plan.input}
      route={plan.result.route}
      flightSchedules={plan.result.flightSchedules}
      housing={plan.result.housing}
      movers={plan.result.movers}
      traces={[
        ...plan.result.traces,
        ...requests.flatMap((item) => item.tools),
      ].slice(-40)}
      housingBrowseUrl={plan.result.housingBrowseUrl}
      movingServicesSource={plan.result.movingServicesSource}
      movingServicesWarning={plan.result.movingServicesWarning}
      selectedHousing={plan.result.selectedHousingId}
      selectedMover={plan.result.selectedMoverId}
      onSelectHousing={(id) => {
        if (!busy)
          void send(
            "",
            {
              action: "selection",
              version: plan.version,
              selection: { housingId: id },
            },
            "PATCH",
          );
      }}
      onSelectMover={(id) => {
        if (!busy)
          void send(
            "",
            {
              action: "selection",
              version: plan.version,
              selection: { moverId: id },
            },
            "PATCH",
          );
      }}
      controls={controls}
    />
  );
}
