"use client";
import { Check, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { movers } from "@/lib/relocation";
import { money } from "@/shared/lib/format";
export function MoverPanel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="mt-5 rounded-xl bg-white shadow-[0_1px_3px_rgba(41,40,39,0.08)] dark:bg-[#1b1938]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Moving services</CardTitle>
          <CardDescription>
            Estimates from demo adapters · request a quote for live pricing
          </CardDescription>
        </div>
        <Truck className="size-5 text-[#155555] dark:text-[#c9b4fa]" />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {movers.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`rounded-lg border p-4 text-left transition ${selected === item.id ? "border-[#155555] bg-[#f4f8f6] dark:border-[#c9b4fa] dark:bg-[#2a2750]" : "border-border hover:border-[#1b1938]/40 dark:hover:border-white/40"}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid size-9 place-items-center rounded-lg bg-[#f5f3ef] text-[#155555] dark:bg-[#252241] dark:text-[#c9b4fa]">
                <Truck className="size-4" />
              </div>
              {selected === item.id && (
                <Check className="size-4 text-[#155555] dark:text-[#c9b4fa]" />
              )}
            </div>
            <div className="mt-4 text-sm font-semibold">{item.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.service}
            </div>
            <div className="mt-4 text-sm font-semibold">
              {money(item.costMin)}–{money(item.costMax)}
            </div>
            <Badge variant="outline" className="mt-2">
              {item.pricing} · DEMO
            </Badge>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
