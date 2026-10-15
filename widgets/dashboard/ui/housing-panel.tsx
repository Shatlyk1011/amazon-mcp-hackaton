"use client";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { housingListingUrl, type Housing } from "@/lib/relocation";
import { money } from "@/shared/lib/format";
export function HousingPanel({
  items,
  browseUrl,
  selected,
  onSelect,
}: {
  items: Housing[];
  browseUrl: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const average = (field: "monthlyRent" | "bedrooms" | "bathrooms") =>
    items.length
      ? items.reduce((total, item) => total + item[field], 0) / items.length
      : 0;
  const averageRent = average("monthlyRent");
  const averageBedrooms = average("bedrooms");
  const averageBathrooms = average("bathrooms");

  return (
    <Card className="rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb] dark:bg-[#171717] dark:ring-[#4d4d4d]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Housing shortlist</CardTitle>
          <CardDescription>
            {items[0]?.source ?? "Live"} listings · select a home to use it in
            your budget
          </CardDescription>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#ebebeb] pt-4 dark:border-[#4d4d4d]">
            {[
              ["Avg. rent", averageRent ? money(Math.round(averageRent)) : "—"],
              ["Avg. beds", averageBedrooms ? averageBedrooms.toFixed(1) : "—"],
              [
                "Avg. baths",
                averageBathrooms ? averageBathrooms.toFixed(1) : "—",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <a
          href={browseUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#0070f3] underline-offset-4 hover:bg-[#d3e5ff]/60 hover:underline dark:text-[#50e3c2] dark:hover:bg-white/10"
        >
          Search Zillow <ArrowRight className="size-3" />
        </a>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {items.length === 0 ? (
          <p className="col-span-full rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            No live rental listings were returned for this destination.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`overflow-hidden rounded-lg border transition ${selected === item.id ? "border-[#0070f3] ring-2 ring-[#d3e5ff] dark:border-[#50e3c2] dark:ring-[#50e3c2]/20" : "border-border hover:border-[#171717]/40 dark:hover:border-white/40"}`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="block w-full text-left"
              >
                {item.image && !item.isDemoData ? (
                  <img
                    src={item.image}
                    alt=""
                    className="h-28 w-full object-cover"
                  />
                ) : null}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-sm font-semibold">
                      {item.title}
                    </div>
                    {selected === item.id && (
                      <Check className="size-4 shrink-0 text-[#0070f3] dark:text-[#50e3c2]" />
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
                    {item.availability} · {item.source ?? "Live"}
                  </Badge>
                </div>
              </button>
              <a
                href={housingListingUrl(item)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 border-t border-[#ebebeb] px-3 py-2 text-xs font-medium text-[#0070f3] hover:bg-[#d3e5ff]/40 dark:border-[#4d4d4d] dark:text-[#50e3c2] dark:hover:bg-white/10"
              >
                View listing <ExternalLink className="size-3" />
              </a>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
