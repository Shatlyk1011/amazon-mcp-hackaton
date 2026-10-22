"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { housingListingUrl, type Housing } from "@/lib/relocation";
import { money } from "@/shared/lib/format";

export type HousingFilters = {
  minRent: string;
  maxRent: string;
  minBedrooms: string;
  minBathrooms: string;
};

const PAGE_SIZE = 6;

function FilterField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder: string;
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
    </label>
  );
}

export function HousingPanel({
  items,
  totalItems,
  browseUrl,
  selected,
  onSelect,
  filters,
  onFiltersChange,
}: {
  items: Housing[];
  totalItems: number;
  browseUrl: string;
  selected: string | null;
  onSelect: (id: string) => void;
  filters: HousingFilters;
  onFiltersChange: (filters: HousingFilters) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleItems = items.slice(0, visibleCount);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const average = (field: "monthlyRent" | "bedrooms" | "bathrooms") =>
    items.length
      ? items.reduce((total, item) => total + item[field], 0) / items.length
      : 0;
  const averageRent = average("monthlyRent");
  const averageBedrooms = average("bedrooms");
  const averageBathrooms = average("bathrooms");

  return (
    <Card className="rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb]">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Housing shortlist</CardTitle>
          <CardDescription>
            {items[0]?.source ?? "Live"} listings · select a home to use it in
            your budget
          </CardDescription>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#ebebeb] pt-4">
            {[
              [
                "Average rent",
                averageRent ? money(Math.round(averageRent)) : "—",
              ],
              [
                "Average beds",
                averageBedrooms ? averageBedrooms.toFixed(1) : "—",
              ],
              [
                "Average baths",
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
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-[#0070f3] underline-offset-4 hover:bg-[#d3e5ff]/60 hover:underline"
        >
          Search Zillow <ArrowRight className="size-3" />
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="rounded-lg border border-[#ebebeb] bg-[#fafafa] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Filter rentals
            </div>
            <span className="text-xs text-muted-foreground">
              {items.length} of {totalItems} listings match
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField
              label="Lowest price"
              value={filters.minRent}
              min={0}
              onChange={(minRent) => onFiltersChange({ ...filters, minRent })}
              placeholder="$0"
            />
            <FilterField
              label="Highest price"
              value={filters.maxRent}
              min={0}
              onChange={(maxRent) => onFiltersChange({ ...filters, maxRent })}
              placeholder="Any"
            />
            <FilterField
              label="Bedrooms"
              value={filters.minBedrooms}
              min={0}
              step={1}
              onChange={(minBedrooms) =>
                onFiltersChange({ ...filters, minBedrooms })
              }
              placeholder="Any"
            />
            <FilterField
              label="Bathrooms"
              value={filters.minBathrooms}
              min={0}
              step={0.5}
              onChange={(minBathrooms) =>
                onFiltersChange({ ...filters, minBathrooms })
              }
              placeholder="Any"
            />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-7 px-2 text-xs"
              onClick={() =>
                onFiltersChange({
                  minRent: "",
                  maxRent: "",
                  minBedrooms: "",
                  minBathrooms: "",
                })
              }
            >
              Clear filters
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="col-span-full rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            No rentals match these filters. Try widening your price range or
            lowering the bedroom and bathroom minimums.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`overflow-hidden rounded-lg border transition ${selected === item.id ? "border-[#0070f3] ring-2 ring-[#d3e5ff]" : "border-border hover:border-[#171717]/40"}`}
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
                          <Check className="size-4 shrink-0 text-[#0070f3]" />
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="text-base font-semibold tabular-nums">
                          {money(item.monthlyRent)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
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
                    className="flex items-center gap-1 border-t border-[#ebebeb] px-3 py-2 text-xs font-medium text-[#0070f3] hover:bg-[#d3e5ff]/40"
                  >
                    View listing <ExternalLink className="size-3" />
                  </a>
                </div>
              ))}
            </div>
            {visibleCount < items.length && (
              <div className="flex justify-center border-t border-[#ebebeb] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setVisibleCount((count) =>
                      Math.min(count + PAGE_SIZE, items.length),
                    )
                  }
                >
                  Show more rentals
                  <span className="text-muted-foreground">
                    ({Math.min(PAGE_SIZE, items.length - visibleCount)} more)
                  </span>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
