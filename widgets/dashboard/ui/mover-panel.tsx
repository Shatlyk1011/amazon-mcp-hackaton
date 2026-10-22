"use client";
import { Check, ExternalLink, MapPin, Phone, Star, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Mover } from "@/lib/relocation";
export function MoverPanel({
  movers,
  selected,
  onSelect,
  source = "TomTom Search API",
  warning,
}: {
    movers: Mover[];
  selected: string | null;
  onSelect: (id: string) => void;
    source?: string;
    warning?: string;
}) {
  console.log('movers', movers)
  return (
    <Card className="rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] ring-[#ebebeb]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Moving services</CardTitle>
          <CardDescription>
            Companies from {source} · ask for a price for your move
          </CardDescription>
        </div>
        <Truck className="size-5 text-[#0070f3]" />
      </CardHeader>
      <CardContent>
        {warning ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            {warning}
          </div>
        ) : null}
        {movers.length === 0 && !warning ? (
          <p className="text-sm text-muted-foreground">
            No matching moving services were found. Try a different route or
            search again later.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {movers.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border p-4 text-left transition ${selected === item.id ? "border-[#0070f3] bg-[#d3e5ff]/35" : "border-border hover:border-[#171717]/40"}`}
            >
              <div className="flex items-start justify-between">
                <div className="grid size-9 place-items-center rounded-md bg-[#f2f2f2] text-[#0070f3]">
                  <Truck className="size-4" />
                </div>
                {selected === item.id && (
                  <Check className="size-4 text-[#0070f3]" />
                )}
              </div>
              <div className="mt-4 text-sm font-semibold">{item.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.service}
              </div>
              {item.address ? (
                <div className="mt-3 flex gap-1.5 text-xs leading-4 text-muted-foreground">
                  <MapPin className="mt-0.5 size-3 shrink-0" />
                  <span>{item.address}</span>
                </div>
              ) : null}
              {item.rating !== undefined ? (
                <Badge variant="outline" className="mt-3 gap-1">
                  <Star className="size-3 fill-current" />
                  {item.rating.toFixed(1)}
                  {item.userRatingCount !== undefined
                    ? ` (${item.userRatingCount.toLocaleString()})`
                    : ""}
                </Badge>
              ) : null}
              {item.distanceMiles !== undefined ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  {item.distanceMiles} miles from your starting city
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="mt-4 min-h-11 w-full rounded-md bg-[#171717] px-3 py-2 text-xs font-medium text-white hover:bg-[#171717]/85"
              >
                {selected === item.id ? "Selected" : "Select service"}
              </button>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-[#0761d1]">
                {item.phone ? (
                  <a href={`tel:${item.phone}`}>
                    <Phone className="inline size-3" /> {item.phone}
                  </a>
                ) : null}
                {item.website ? (
                  <a href={item.website} target="_blank" rel="noreferrer">
                    Website <ExternalLink className="inline size-3" />
                  </a>
                ) : null}
                {item.googleMapsUrl ? (
                  <a href={item.googleMapsUrl} target="_blank" rel="noreferrer">
                    Maps <ExternalLink className="inline size-3" />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
