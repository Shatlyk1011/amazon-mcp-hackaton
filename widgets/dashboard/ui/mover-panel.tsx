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
    <Card className="mt-5 rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb] dark:bg-[#171717] dark:ring-[#4d4d4d]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Moving services</CardTitle>
          <CardDescription>
            Estimates from demo adapters · request a quote for live pricing
          </CardDescription>
        </div>
        <Truck className="size-5 text-[#0070f3]" />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {movers.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`rounded-lg border p-4 text-left transition ${selected === item.id ? "border-[#0070f3] bg-[#d3e5ff]/35 dark:border-[#50e3c2] dark:bg-white/5" : "border-border hover:border-[#171717]/40 dark:hover:border-white/40"}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid size-9 place-items-center rounded-md bg-[#f2f2f2] text-[#0070f3] dark:bg-white/10 dark:text-[#50e3c2]">
                <Truck className="size-4" />
              </div>
              {selected === item.id && (
                <Check className="size-4 text-[#0070f3] dark:text-[#50e3c2]" />
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
