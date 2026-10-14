import { CircleDollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateBudget, type RelocationInput } from "@/lib/relocation";
import { money } from "@/shared/lib/format";
export function BudgetPanel({
  budget,
  input,
}: {
  budget: ReturnType<typeof calculateBudget> | null;
  input: RelocationInput;
}) {
  if (!budget) return null;
  const rows = [
    ["Housing upfront", budget.housingUpfront],
    ["Transportation", budget.transportation],
    ["Moving services", budget.moving],
    ["Packing + pets", budget.additional],
  ] as const;
  return (
    <Card className="rounded-xl bg-white shadow-[0_1px_3px_rgba(41,40,39,0.08)] dark:bg-[#1b1938]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Budget pulse</CardTitle>
          <p className="text-sm text-muted-foreground">
            One-time costs · rent stays separate
          </p>
        </div>
        <CircleDollarSign className="size-5 text-[#155555] dark:text-[#c9b4fa]" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-muted-foreground">
              RECOMMENDED ESTIMATE
            </div>
            <div className="mt-1 text-4xl font-[540] tracking-[-0.04em]">
              {money(budget.recommended)}
            </div>
          </div>
          <div
            className={`text-right text-sm font-semibold ${budget.remaining >= 0 ? "text-[#155555] dark:text-[#8be0b0]" : "text-[#b42318] dark:text-[#f97066]"}`}
          >
            {budget.remaining >= 0
              ? `${money(budget.remaining)} left`
              : `${money(Math.abs(budget.remaining))} over`}
          </div>
        </div>
        <Progress
          value={Math.min(
            100,
            Math.max(12, (budget.recommended / input.budget) * 100),
          )}
          className="mt-5"
        />
        <div className="mt-5 flex flex-col gap-3">
          {rows.map(([label, amount]) => (
            <div
              key={label}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium">{money(amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-center">
          {[
            ["Minimal", budget.minimal],
            ["Comfortable", budget.recommended],
            ["Full-service", budget.fullService],
          ].map(([label, amount]) => (
            <div key={label}>
              <div className="text-[10px] uppercase text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-sm font-semibold">
                {money(amount as number)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
