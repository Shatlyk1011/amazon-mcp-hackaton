"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, LoaderCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { IntakeAnswer, SavedIntakeView } from "@/lib/intake/schema";

export const factLabels: Record<string, string> = {
  origin: "Moving from",
  destination: "Moving to",
  movingDate: "Planning date",
  flexible: "Flexible date",
  budget: "Total move budget ($)",
  adults: "Adults",
  children: "Children",
  pets: "Pets",
  bedrooms: "Home size (bedrooms)",
  suitcases: "Suitcases",
  furniture: "Moving furniture",
  transport: "Travel preference",
  needsHousing: "Search rentals",
  maxRent: "Monthly rent limit ($)",
  minBedrooms: "Minimum bedrooms",
  petFriendly: "Pet-friendly housing",
  neighborhood: "Neighborhood",
  workInfo: "Work and commute",
  petInfo: "Pet details",
  accessibilityNeeds: "Accessibility",
  otherNeeds: "Other priorities",
};
const sourceLabels: Record<string, string> = {
  request: "Your request",
  saved_context: "Saved context",
  answer: "Your answer",
  market: "Local rental listings",
  income: "Based on income",
};

export function MoveIntake({
  intake,
  pending,
  error,
  onAnswers,
  onBack,
  onComplete,
  onStartOver,
}: {
  intake: SavedIntakeView;
  pending: boolean;
  error?: string;
  onAnswers: (answers: IntakeAnswer[]) => void;
  onBack: () => void;
  onComplete: () => void;
  onStartOver: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, IntakeAnswer>>({});
  const [incomeQuestions, setIncomeQuestions] = useState<Set<string>>(
    new Set(),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const questions = intake.questions;
  const needsHousingAnswer = answers.housing?.choice;
  const visibleQuestions = questions.filter(
    (question) =>
      needsHousingAnswer !== "no" ||
      !["bedrooms", "rent"].includes(question.id),
  );
  const unanswered = visibleQuestions.filter((question) => {
    const answer = answers[question.id];
    return !answer?.choice && !answer?.text?.trim() && !answer?.monthlyIncome;
  });
  function updateAnswer(
    questionId: string,
    answer: Omit<IntakeAnswer, "questionId">,
  ) {
    setAnswers((current) => ({
      ...current,
      [questionId]: { questionId, ...answer },
    }));
  }
  function toggleIncomeQuestion(questionId: string) {
    setIncomeQuestions((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
    updateAnswer(questionId, {});
  }
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8">
      <header className="mx-auto mb-10 flex max-w-3xl items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <Compass className="size-5" />
          MoveFlow
        </span>
        <Button variant="ghost" disabled={pending} onClick={onStartOver}>
          Start another request
        </Button>
      </header>
      <Card className="mx-auto max-w-3xl rounded-3xl">
        <CardHeader>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Badge variant="secondary">Move setup</Badge>
            <span className="text-xs text-muted-foreground" role="status">
              {intake.ready
                ? pending
                  ? "Building your plan"
                  : "Ready to retry"
                : `${unanswered.length} answer${unanswered.length === 1 ? "" : "s"} left`}
            </span>
          </div>
          <CardTitle>
            <h1 ref={heading} tabIndex={-1} className="outline-none">
              {intake.ready
                ? pending
                  ? "Building your moving plan"
                  : "Your move setup is ready"
                : "Tell us about your move"}
            </h1>
          </CardTitle>
          <CardDescription>
            {intake.ready
              ? pending
                ? "We’re preparing your route, housing options, moving services, budget, and timeline."
                : "Your answers are saved. You can retry building your plan or edit your setup."
              : "Answer the questions below. We’ll save your completed answers together when you continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {intake.state.prompt ? (
            <p className="border-l-2 border-border pl-4 text-sm text-muted-foreground">
              “{intake.state.prompt}”
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!intake.ready ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAnswers(
                  visibleQuestions.map((question) => answers[question.id]!),
                );
              }}
            >
              <FieldGroup className="gap-6">
                {visibleQuestions.map((question, index) => {
                  const answer = answers[question.id];
                  const incomeMode = incomeQuestions.has(question.id);
                  const value = incomeMode
                    ? String(answer?.monthlyIncome ?? "")
                    : (answer?.text ?? "");
                  return (
                    <fieldset
                      key={question.id}
                      className="rounded-2xl border border-border p-4 sm:p-5"
                    >
                      <legend className="px-1 text-sm font-semibold">
                        {index + 1}. {question.title}
                      </legend>
                      <p className="mb-4 text-sm text-muted-foreground">
                        {question.description}
                      </p>
                      <FieldGroup>
                        {question.options.length > 0 && !incomeMode ? (
                          <Field>
                            <FieldLabel id={`${question.id}-answers-label`}>
                              Choose an answer
                            </FieldLabel>
                            <ToggleGroup
                              aria-labelledby={`${question.id}-answers-label`}
                              variant="outline"
                              orientation="vertical"
                              className="w-full"
                              value={answer?.choice ? [answer.choice] : []}
                              onValueChange={(values) =>
                                updateAnswer(question.id, {
                                  choice: values[0] ?? undefined,
                                })
                              }
                              disabled={pending}
                            >
                              {question.options.map((option) => (
                                <ToggleGroupItem
                                  key={option.id}
                                  value={option.id}
                                  className="h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left"
                                >
                                  {option.label}
                                </ToggleGroupItem>
                              ))}
                            </ToggleGroup>
                          </Field>
                        ) : null}
                        <Field>
                          <FieldLabel htmlFor={`answer-${question.id}`}>
                            {incomeMode
                              ? "Monthly take-home income ($)"
                              : question.options.length
                                ? "Or type your own answer"
                                : "Your answer"}
                          </FieldLabel>
                          <Input
                            id={`answer-${question.id}`}
                            type={
                              incomeMode
                                ? "number"
                                : (question.inputType ?? "text")
                            }
                            min={
                              incomeMode || question.inputType === "number"
                                ? 1
                                : question.inputType === "date"
                                  ? intake.state.referenceDate
                                  : undefined
                            }
                            maxLength={2000}
                            placeholder={
                              incomeMode
                                ? "For example, 6000"
                                : question.placeholder
                            }
                            value={value}
                            onChange={(e) =>
                              updateAnswer(
                                question.id,
                                incomeMode
                                  ? e.target.value
                                    ? { monthlyIncome: Number(e.target.value) }
                                    : {}
                                  : { text: e.target.value },
                              )
                            }
                            disabled={pending}
                          />
                          {incomeMode ? (
                            <FieldDescription>
                              We’ll suggest 30% as a starting rent limit. The
                              income amount itself is not saved.
                            </FieldDescription>
                          ) : null}
                        </Field>
                        {question.id === "rent" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            className="self-start"
                            disabled={pending}
                            onClick={() => toggleIncomeQuestion(question.id)}
                          >
                            {incomeMode
                              ? "Enter rent directly instead"
                              : "Help me estimate rent from income (optional)"}
                          </Button>
                        ) : null}
                      </FieldGroup>
                    </fieldset>
                  );
                })}
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    disabled={pending || !intake.canGoBack}
                  >
                    <ArrowLeft data-icon="inline-start" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending || unanswered.length > 0}
                  >
                    {pending ? (
                      <LoaderCircle
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : null}
                    {pending ? "Saving answers…" : "Save answers and continue"}
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </FieldGroup>
            </form>
          ) : pending ? (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Building your dashboard…
            </p>
          ) : (
            <>
              <dl className="grid gap-4 sm:grid-cols-2">
                {intake.summary.map((fact) => (
                  <div key={fact.field} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {factLabels[fact.field] ?? fact.field} ·{" "}
                      {sourceLabels[fact.source] ?? fact.source}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-medium">
                      {fact.value === "true"
                        ? "Yes"
                        : fact.value === "false"
                          ? "No"
                          : fact.value || "Not specified"}
                    </dd>
                  </div>
                ))}
              </dl>
              <Alert>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {intake.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={onBack}
                  disabled={pending || !intake.canGoBack}
                >
                  <ArrowLeft data-icon="inline-start" />
                  Edit setup answers
                </Button>
                <Button disabled={pending} onClick={onComplete}>
                  {pending ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : null}
                  {pending
                    ? "Building your dashboard…"
                    : "Retry building my plan"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {intake.ready
              ? "Your answers are saved to this browser’s MoveFlow session. You can return and continue."
              : "Your answers will be saved together when you continue."}{" "}
            {intake.state.contextIncluded
              ? "Your saved context is included in this move."
              : "Only the details you supplied for this move are being used."}
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
