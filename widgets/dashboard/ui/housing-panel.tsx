"use client";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { housing } from "@/lib/relocation";
import { money } from "@/shared/lib/format";
export function HousingPanel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="rounded-xl bg-white shadow-[0_1px_3px_rgba(41,40,39,0.08)] dark:bg-[#1b1938]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Housing shortlist</CardTitle>
          <CardDescription>
            Demo listings · New York · 2+ beds · pet-friendly where marked
          </CardDescription>
        </div>
        <a
          href="https://www.zillow.com/"
          target="_blank"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-[#1b1938] underline-offset-4 hover:bg-[#f5f3ef] hover:underline dark:text-[#c9b4fa] dark:hover:bg-white/10"
        >
          Search Zillow <ArrowRight className="size-3" />
        </a>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {housing.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`overflow-hidden rounded-lg border text-left transition ${selected === item.id ? "border-[#155555] ring-2 ring-[#b7d9d0] dark:border-[#c9b4fa] dark:ring-[#c9b4fa]/20" : "border-border hover:border-[#1b1938]/40 dark:hover:border-white/40"}`}
          >
            <img src={item.image} alt="" className="h-28 w-full object-cover" />
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-sm font-semibold">
                  {item.title}
                </div>
                {selected === item.id && (
                  <Check className="size-4 shrink-0 text-[#155555] dark:text-[#c9b4fa]" />
                )}
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {item.address}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-semibold">
                  {money(item.monthlyRent)}{" "}
                  <span className="font-normal text-muted-foreground">
                    / mo
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {item.bedrooms} bd · {item.bathrooms} ba
                </span>
              </div>
              <Badge variant="outline" className="mt-2">
                {item.availability} · DEMO
              </Badge>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
