"use client";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { IntakeFields } from "@/lib/intake/schema";

const numericFields = [
  ["adults", "Adults", 1],
  ["children", "Children", 0],
  ["pets", "Pets", 0],
  ["minBedrooms", "Bedrooms needed", 0],
  ["maxRent", "Monthly rent limit ($)", 0],
  ["budget", "Total move budget ($)", 0],
] as const;
const noteFields = [
  [
    "workInfo",
    "Work and commute",
    "Work location, remote work, commute preferences…",
  ],
  ["petInfo", "Pet details", "Species, size, travel or housing needs…"],
  [
    "accessibilityNeeds",
    "Accessibility needs",
    "Step-free access, assistance, or other needs…",
  ],
  [
    "otherNeeds",
    "Other preferences",
    "School, neighborhood, timing, or other priorities…",
  ],
] as const;

const demoContext: IntakeFields = {
  adults: 2,
  children: 1,
  pets: 1,
  minBedrooms: 2,
  maxRent: 2800,
  budget: 12000,
  workInfo: "Hybrid work in downtown Austin; commute under 35 minutes.",
  petInfo: "One small dog; needs nearby parks and pet-friendly housing.",
  otherNeeds:
    "Family-friendly neighborhood with good schools and groceries nearby.",
};

export function MoveContext({
  included,
  onIncludedChange,
  onContextChange,
  disabled,
}: {
  included: boolean;
  onIncludedChange: (value: boolean) => void;
  onContextChange: (context: IntakeFields) => void;
  disabled: boolean;
}) {
  const [saved, setSaved] = useState<IntakeFields>({});
  const [draft, setDraft] = useState<IntakeFields>(demoContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profile", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setSaved(data.context);
        const nextDraft = Object.keys(data.context).length
          ? data.context
          : { ...demoContext };
        setDraft(nextDraft);
        onContextChange(nextDraft);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause.message || "Could not load saved context.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function save(context: IntakeFields) {
    setSaving(true);
    setError(undefined);
    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(context),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save context.");
      setSaved(data.context);
      setDraft(data.context);
      onContextChange(data.context);
      if (!Object.keys(data.context).length) onIncludedChange(false);
      return data.context as IntakeFields;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save context.",
      );
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  function changeIncluded(value: boolean) {
    if (!value) {
      onIncludedChange(false);
      return;
    }

    setContextOpen(true);
    onIncludedChange(true);
  }

  function updateDraft(context: IntakeFields) {
    setDraft(context);
    onContextChange(context);
  }

  const hasContext = Object.keys(saved).length > 0;
  const previewContext = hasContext ? saved : draft;
  const preview = [
    previewContext.adults !== undefined &&
      `${previewContext.adults} adult${previewContext.adults === 1 ? "" : "s"}`,
    previewContext.children !== undefined &&
      `${previewContext.children} children`,
    previewContext.pets !== undefined && `${previewContext.pets} pets`,
    previewContext.minBedrooms !== undefined &&
      `${previewContext.minBedrooms} bedrooms`,
    previewContext.workInfo,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section
      className="mt-6 w-full max-w-xl rounded-2xl border border-border bg-muted/20 p-4 text-left sm:p-5"
      aria-labelledby="move-context-title"
    >
      <p
        id="move-context-title"
        className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        Move context
      </p>
      <Field orientation="horizontal" className="rounded-lg bg-background p-3">
        <Checkbox
          id="include-move-context"
          checked={included}
          onCheckedChange={changeIncluded}
          disabled={disabled || loading || saving}
        />
        <FieldContent>
          <FieldLabel htmlFor="include-move-context">
            Include my move context
          </FieldLabel>
          <FieldDescription>
            {hasContext
              ? preview || "Use your saved preferences for this request."
              : `Demo context ready: ${preview}.`}{" "}
            {included
              && <em>This context will be used for your move request</em>}
          </FieldDescription>
        </FieldContent>
      </Field>
      <details
        open={contextOpen}
        onToggle={(event) => setContextOpen(event.currentTarget.open)}
        className="mt-3"
      >
        <summary className="cursor-pointer rounded-md px-1 py-2 text-sm font-medium hover:bg-background/70">
          {hasContext ? "Review or edit saved context" : "Review demo context"}
        </summary>
        <form
          className="mt-3 rounded-lg border border-border bg-background p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              {numericFields.map(([key, label, min]) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`context-${key}`}>{label}</FieldLabel>
                  <Input
                    id={`context-${key}`}
                    type="number"
                    min={min}
                    max={
                      key === "adults" ||
                      key === "children" ||
                      key === "pets" ||
                      key === "minBedrooms"
                        ? 20
                        : undefined
                    }
                    value={draft[key] ?? ""}
                    placeholder="Not specified"
                    disabled={disabled || loading || saving}
                    onChange={(e) => {
                      const next = { ...draft };
                      if (e.target.value === "") delete next[key];
                      else next[key] = Number(e.target.value);
                      updateDraft(next);
                    }}
                  />
                </Field>
              ))}
            </div>
            {noteFields.map(([key, label, placeholder]) => (
              <Field key={key}>
                <FieldLabel htmlFor={`context-${key}`}>{label}</FieldLabel>
                <Textarea
                  id={`context-${key}`}
                  value={draft[key] ?? ""}
                  maxLength={
                    key === "workInfo" || key === "otherNeeds" ? 1500 : 1000
                  }
                  placeholder={placeholder}
                  disabled={disabled || loading || saving}
                  onChange={(e) => {
                    const next = { ...draft };
                    if (!e.target.value) delete next[key];
                    else next[key] = e.target.value;
                    updateDraft(next);
                  }}
                />
              </Field>
            ))}
            <FieldDescription>
              {hasContext
                ? "Saved to your MoveFlow session in this browser."
                : "Demo data is used for this request when enabled; use Save context to keep it for future requests."}
            </FieldDescription>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={disabled || loading || saving}>
                {saving ? "Saving…" : "Save context"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || loading || saving || !hasContext}
                onClick={() => void save({})}
              >
                Clear saved context
              </Button>
            </div>
          </FieldGroup>
        </form>
      </details>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
