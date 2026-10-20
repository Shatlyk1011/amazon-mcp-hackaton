"use client";

import { useState, type ReactNode } from "react";

export function MapInteractionGuard({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);

  return (
    <div
      className="group relative size-full"
      onMouseLeave={() => setActive(false)}
    >
      {children}
      {!active && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => setActive(true)}
          >
            Click to interact with map
          </button>
        </div>
      )}
    </div>
  );
}
