"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingPage } from "@/widgets/landing/ui/landing-page";
import { MoveContext } from "@/features/move-intake/ui/move-context";
import { MoveIntake } from "@/features/move-intake/ui/move-intake";
import { TravelModeSelection } from "@/features/move-intake/ui/travel-mode-selection";
import { Button } from "@/components/ui/button";
import type {
  IntakeAnswer,
  IntakeFields,
  SavedIntakeView,
} from "@/lib/intake/schema";

export default function Home() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [includeContext, setIncludeContext] = useState(false);
  const [moveContext, setMoveContext] = useState<IntakeFields>({});
  const [transport, setTransport] = useState<IntakeFields["transport"]>();
  const [intake, setIntake] = useState<SavedIntakeView>();
  const [resumable, setResumable] = useState<SavedIntakeView>();
  const active = useRef(false);
  const attempt = useRef<{ input: string; id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/intake", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        if (r.ok) setResumable((await r.json()).intake ?? undefined);
      })
      .catch(() => {
        /* A new request can still be started. */
      });
    return () => controller.abort();
  }, []);
  async function send(endpoint: string, payload: unknown, method = "POST") {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && intake) {
          const latest = await fetch(`/api/intake/${intake.id}`, {
            cache: "no-store",
          });
          if (latest.ok) setIntake((await latest.json()).intake);
        }
        throw new Error(data.error || "Could not continue your move setup.");
      }
      if (data.plan) router.push(`/dashboard/${data.plan.id}`);
      else if (data.intake) {
        setIntake(data.intake);
        setResumable(undefined);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not continue your move setup.",
      );
    } finally {
      active.current = false;
      setPending(false);
    }
  }
  function begin(prompt: string) {
    const known = transport ? { transport } : {};
    const input = JSON.stringify({
      prompt,
      includeContext,
      moveContext,
      known,
    });
    if (attempt.current?.input !== input)
      attempt.current = { input, id: crypto.randomUUID() };
    return send("/api/intake", {
      prompt,
      known,
      includeContext,
      context: includeContext ? moveContext : undefined,
      requestId: attempt.current.id,
    });
  }
  function act(
    action: "answers" | "back" | "complete",
    answers?: IntakeAnswer[],
  ) {
    if (!intake) return;
    return send(
      `/api/intake/${intake.id}`,
      { action, version: intake.version, ...(answers ? { answers } : {}) },
      "PATCH",
    );
  }
  if (intake)
    return (
      <MoveIntake
        key={`${intake.id}:${intake.version}`}
        intake={intake}
        pending={pending}
        error={error}
        onAnswers={(answers) => act("answers", answers)}
        onBack={() => act("back")}
        onComplete={() => act("complete")}
        onStartOver={() => {
          setIntake(undefined);
          setError(undefined);
          attempt.current = null;
        }}
      />
    );
  return (
    <LandingPage
      onPromptSubmit={begin}
      pending={pending}
      error={error}
      contextControls={
        <>
          <TravelModeSelection
            value={transport}
            onChange={setTransport}
            disabled={pending}
          />
          <MoveContext
            included={includeContext}
            onIncludedChange={setIncludeContext}
            onContextChange={setMoveContext}
            disabled={pending}
          />
        </>
      }
      resumeControl={
        resumable ? (
          <Button
            variant="outline"
            onClick={() => {
              setIntake(resumable);
              setError(undefined);
            }}
          >
            Continue your saved move setup
          </Button>
        ) : null
      }
    />
  );
}
