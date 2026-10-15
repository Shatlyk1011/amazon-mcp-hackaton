"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { groupCitiesByState } from "@mardillu/us-cities-utils";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

type CityRecord = ReturnType<typeof groupCitiesByState>[string][number];

const cityKeys = new Set<string>();
const allCities = Object.values(groupCitiesByState())
  .flat()
  .filter((city) => {
    const key = `${city.name}, ${city.stateAbbr}`;
    if (cityKeys.has(key)) return false;
    cityKeys.add(key);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const popularCityLabels = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Miami, FL",
  "San Francisco, CA",
  "Seattle, WA",
  "Boston, MA",
];

const popularCities = popularCityLabels
  .map((label) => allCities.find((city) => cityLabel(city) === label))
  .filter((city): city is CityRecord => city !== undefined);

function cityLabel(city: CityRecord) {
  return `${city.name}, ${city.stateAbbr}`;
}

export function CityAutocomplete({
  value,
  onChange,
  placeholder = "City, state",
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `city-options-${useId()}`;

  const suggestions = useMemo(() => {
    const query = searchTerm?.trim().toLowerCase();
    if (!query) return popularCities;
    return allCities
      .filter((city) => cityLabel(city).toLowerCase().includes(query))
      .sort((a, b) => {
        const aLabel = cityLabel(a).toLowerCase();
        const bLabel = cityLabel(b).toLowerCase();
        return (
          Number(!aLabel.startsWith(query)) -
            Number(!bLabel.startsWith(query)) || aLabel.localeCompare(bLabel)
        );
      })
      .slice(0, 8);
  }, [searchTerm]);

  function selectCity(city: CityRecord) {
    onChange(cityLabel(city));
    setOpen(false);
    setSearchTerm(null);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) =>
        suggestions.length ? (index + 1) % suggestions.length : -1,
      );
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) =>
        suggestions.length
          ? index < 0
            ? suggestions.length - 1
            : (index - 1 + suggestions.length) % suggestions.length
          : -1,
      );
    }
    if (event.key === "Enter" && open && suggestions[highlightedIndex]) {
      event.preventDefault();
      selectCity(suggestions[highlightedIndex]);
    }
    if (event.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          required={required}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={
            open && suggestions[highlightedIndex]
              ? `${listId}-${highlightedIndex}`
              : undefined
          }
          onChange={(event) => {
            onChange(event.target.value);
            setSearchTerm(event.target.value);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setSearchTerm(null);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onClick={() => setOpen(true)}
          onBlur={(event) => {
            if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-10 rounded-md bg-white px-3 pr-9 text-sm",
            className,
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#73706d]" />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-lg border border-[#e8e4dd] bg-white p-1 shadow-[0_8px_24px_rgba(41,40,39,0.12)]"
        >
          {suggestions.length === 0 && (
            <p className="px-3 py-2 text-sm font-normal text-[#73706d]">
              No matching cities. You can still enter a location.
            </p>
          )}
          {suggestions.map((city, index) => (
            <button
              key={`${city.name}-${city.stateAbbr}`}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={cityLabel(city) === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCity(city)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-[#292827]",
                index === highlightedIndex
                  ? "bg-[#f1eef8]"
                  : "hover:bg-[#f5f3ef]",
              )}
            >
              <span>{cityLabel(city)}</span>
              {cityLabel(city) === value && (
                <Check className="size-4 text-[#155555]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
