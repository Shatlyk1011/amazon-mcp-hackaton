"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import type { IntakeFields } from "@/lib/intake/schema";

type Transport = IntakeFields["transport"];

export function TravelModeSelection({
  value,
  onChange,
  disabled,
}: {
  value?: Transport;
  onChange: (value?: Transport) => void;
  disabled: boolean;
}) {
  const driving = value === "drive" || value === "compare";
  const flying = value === "fly" || value === "compare";
  function setMode(nextDriving: boolean, nextFlying: boolean) {
    onChange(
      nextDriving && nextFlying
        ? "compare"
        : nextDriving
          ? "drive"
          : nextFlying
            ? "fly"
            : undefined,
    );
  }
  return (
    <FieldSet className="mt-6 w-full max-w-xl rounded-2xl border border-border bg-muted/20 p-4 text-left sm:p-5">
      <FieldLegend>Travel options</FieldLegend>
      <FieldDescription>
        Optional. Choose driving, airplane, or both. Leave both clear and the
        setup quiz will ask you.
      </FieldDescription>
      <FieldGroup className="gap-3" data-slot="checkbox-group">
        <Field orientation="horizontal" data-disabled={disabled || undefined}>
          <Checkbox
            id="travel-driving"
            checked={driving}
            onCheckedChange={(checked) => setMode(Boolean(checked), flying)}
            disabled={disabled}
          />
          <FieldLabel htmlFor="travel-driving">Driving</FieldLabel>
        </Field>
        <Field orientation="horizontal" data-disabled={disabled || undefined}>
          <Checkbox
            id="travel-airplane"
            checked={flying}
            onCheckedChange={(checked) => setMode(driving, Boolean(checked))}
            disabled={disabled}
          />
          <FieldLabel htmlFor="travel-airplane">Airplane</FieldLabel>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
