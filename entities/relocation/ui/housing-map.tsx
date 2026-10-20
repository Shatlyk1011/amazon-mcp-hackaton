"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Home, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { housingListingUrl, type Housing } from "@/lib/relocation";
import { money } from "@/shared/lib/format";
import { MapInteractionGuard } from "./map-interaction-guard";

export function HousingMap({
  listings,
  onSelect,
}: {
  listings: Housing[];
  onSelect: (id: string) => void;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const mappableListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          Number.isFinite(listing.lat) && Number.isFinite(listing.lng),
      ),
    [listings],
  );

  useEffect(() => {
    if (!token || !mapContainer.current || mappableListings.length === 0)
      return;
    mapboxgl.accessToken = token;
    const container = mapContainer.current;
    const bounds = new mapboxgl.LngLatBounds();
    mappableListings.forEach((listing) =>
      bounds.extend([listing.lng, listing.lat]),
    );
    let disposed = false;

    const createPopup = (listing: Housing) => {
      const content = document.createElement("div");
      content.className = "min-w-44 p-1 text-[#171717]";
      const title = document.createElement("strong");
      title.className = "block text-sm";
      title.textContent = listing.title;
      const address = document.createElement("span");
      address.className = "mt-1 block text-xs text-[#4d4d4d]";
      address.textContent = listing.address;
      const facts = document.createElement("span");
      facts.className = "mt-2 block text-xs font-medium";
      facts.textContent = `${money(listing.monthlyRent)} / mo · ${listing.bedrooms} bd · ${listing.bathrooms} ba`;
      const link = document.createElement("a");
      link.className =
        "mt-2 block text-xs font-medium text-[#0070f3] underline";
      link.href = housingListingUrl(listing);
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "View listing";
      content.append(title, address, facts, link);
      return content;
    };

    const initialize = () => {
      if (
        disposed ||
        container.clientWidth === 0 ||
        container.clientHeight === 0 ||
        mapRef.current
      )
        return;
      try {
        const map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/dark-v11",
          center: [mappableListings[0].lng, mappableListings[0].lat],
          zoom: 11,
          attributionControl: true,
        });
        mapRef.current = map;
        map.on("error", (event) => {
          setMapError(
            event.error?.message ?? "Mapbox failed to load the listings map",
          );
        });
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.on("load", () => {
          map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 13 });
          mappableListings.forEach((listing) => {
            const popup = new mapboxgl.Popup({ offset: 18 }).setDOMContent(
              createPopup(listing),
            );
            const marker = new mapboxgl.Marker({ color: "#0070f3" })
              .setLngLat([listing.lng, listing.lat])
              .addTo(map);
            const markerElement = marker.getElement();
            let closeTimer: number | undefined;
            let popupElement: HTMLElement | null = null;
            const cancelClose = () => {
              if (closeTimer) window.clearTimeout(closeTimer);
            };
            const scheduleClose = () => {
              cancelClose();
              closeTimer = window.setTimeout(() => popup.remove(), 180);
            };
            const showPopup = () => {
              cancelClose();
              onSelect(listing.id);
              popup.setLngLat([listing.lng, listing.lat]).addTo(map);
              if (!popupElement) {
                popupElement = popup.getElement() ?? null;
                popupElement?.addEventListener("mouseenter", cancelClose);
                popupElement?.addEventListener("mouseleave", scheduleClose);
              }
            };
            markerElement.setAttribute("aria-label", listing.title);
            markerElement.setAttribute("title", `Hover for ${listing.title}`);
            markerElement.tabIndex = 0;
            markerElement.addEventListener("mouseenter", showPopup);
            markerElement.addEventListener("mouseleave", scheduleClose);
            markerElement.addEventListener("focus", showPopup);
            markerElement.addEventListener("blur", scheduleClose);
            markersRef.current.push(marker);
          });
        });
      } catch (error) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Mapbox failed to load the listings map",
        );
      }
    };
    const resizeObserver = new ResizeObserver(initialize);
    resizeObserver.observe(container);
    initialize();
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mappableListings, onSelect, token]);

  console.log('listings', listings)

  return (
    <Card className="gap-0 overflow-hidden rounded-xl bg-card py-0 ring-[#ebebeb]">
      <CardHeader className="gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Home aria-hidden="true" className="size-4 text-muted-foreground" />
            Available rentals
          </CardTitle>
          <Badge variant="secondary">
            {listings.length ? `${listings.length} listings` : "No listings"}
          </Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Hover a marker to inspect rent, size, address, and the original
          listing.
        </p>
      </CardHeader>
      <CardContent className="px-0">
        <div className="relative h-[420px] w-full bg-[#171717] sm:h-[500px]">
          {token && mappableListings.length > 0 ? (
            <MapInteractionGuard>
              <div ref={mapContainer} className="size-full" />
            </MapInteractionGuard>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-white">
              <MapPin aria-hidden="true" className="size-6 text-[#50e3c2]" />
              <p className="text-sm font-medium">
                {token ? "No mapped listings" : "Map preview unavailable"}
              </p>
              <p className="max-w-xs text-xs text-white/65">
                {token
                  ? "The housing provider returned no listings with coordinates."
                  : "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render rental markers."}
              </p>
            </div>
          )}
          {mapError && (
            <div
              role="status"
              className="absolute inset-x-5 bottom-5 rounded-md bg-black/75 px-3 py-2 text-xs text-white"
            >
              {mapError}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
