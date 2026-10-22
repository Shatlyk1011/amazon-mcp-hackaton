"use client";
import { useEffect, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function MoveContext({
  included,
  onIncludedChange,
  onContextChange,
  disabled,
}: {
  included: boolean;
  onIncludedChange: (value: boolean) => void;
  onContextChange: (context: string) => void;
  disabled: boolean;
}) {
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [contextOpen, setContextOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/profile", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSaved(data.context);
        setDraft(data.context);
        onContextChange(data.context);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause.message || "Could not load saved context.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [onContextChange]);
  async function save(text: string) {
    setSaving(true);
    setError(undefined);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save context.");
      setSaved(data.context);
      setDraft(data.context);
      onContextChange(data.context);
      if (!data.context.trim()) onIncludedChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save context.",
      );
    } finally {
      setSaving(false);
    }
  }
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
          disabled={disabled || loading || saving}
          onCheckedChange={(value) => {
            onIncludedChange(value);
            if (value) setContextOpen(true);
          }}
        />
        <FieldContent>
          <FieldLabel htmlFor="include-move-context">
            Include my move context
          </FieldLabel>
          <FieldDescription>
            {included
              ? "We’ll use this context with your request and ask about missing details."
              : "Add details about your household, budget, needs, or preferences."}
          </FieldDescription>
        </FieldContent>
      </Field>
      <details
        open={contextOpen}
        onToggle={(event) => setContextOpen(event.currentTarget.open)}
        className="mt-3"
      >
        <summary className="cursor-pointer rounded-md px-1 py-2 text-sm font-medium hover:bg-background/70">
          {saved ? "Review or edit saved context" : "Add move context"}
        </summary>
        <form
          className="mt-3 rounded-lg border border-border bg-background p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save(draft);
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="move-context-text">
                Your move context
              </FieldLabel>
              <Textarea
                id="move-context-text"
                rows={7}
                maxLength={8000}
                value={draft}
                disabled={disabled || loading || saving}
                placeholder="For example: Two adults, one child and a small dog. We need two bedrooms and can spend up to $2,800 per month on rent. I work downtown and prefer a short commute."
                onChange={(event) => {
                  setDraft(event.target.value);
                  onContextChange(event.target.value);
                }}
              />
              <FieldDescription>
                Include any details you want considered, such as household,
                housing, budget, work, pets, or accessibility needs. Your
                current request takes priority.
              </FieldDescription>
            </Field>
            <FieldDescription>
              {saved
                ? "Saved to your MoveFlow session in this browser."
                : "Save context to use it in future requests. Your current text is used when included."}
            </FieldDescription>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={disabled || loading || saving}>
                {saving ? "Saving…" : "Save context"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || loading || saving || !saved}
                onClick={() => void save("")}
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
