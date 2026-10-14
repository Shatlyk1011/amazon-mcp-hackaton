"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RouteResult } from "@/lib/providers/mapbox";

type RouteMapProps = {
  route: RouteResult | null;
};
type RouteLineGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

// Static Images URLs have a size limit. Keep the full route for the interactive
// map, but use a bounded preview for the image underneath it.
function staticRouteGeometry(geometry: RouteLineGeometry): RouteLineGeometry {
  if (geometry.coordinates.length < 2) return geometry;
  const count = Math.min(geometry.coordinates.length, 100);
  return {
    type: "LineString",
    coordinates: Array.from({ length: count }, (_, index) => {
      const point =
        geometry.coordinates[
          Math.round((index * (geometry.coordinates.length - 1)) / (count - 1))
        ];
      return [Number(point[0].toFixed(4)), Number(point[1].toFixed(4))];
    }),
  };
}

export function RouteMap({ route }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const hasLiveGeometry = Boolean(
    token && route?.status === "live" && route.geometry,
  );
  const durationMinutes = route ? Math.round(route.durationHours * 60) : 0;
  const duration = route
    ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
    : "—";
  const staticMapUrl =
    hasLiveGeometry && route
      ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/geojson(${encodeURIComponent(
          JSON.stringify({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: { stroke: "#152b2b", "stroke-width": 4 },
                geometry: staticRouteGeometry(
                  route.geometry as RouteLineGeometry,
                ),
              },
              ...(route.originCoordinates
                ? [
                    {
                      type: "Feature",
                      properties: { "marker-color": "#152b2b" },
                      geometry: {
                        type: "Point",
                        coordinates: [
                          route.originCoordinates.longitude,
                          route.originCoordinates.latitude,
                        ],
                      },
                    },
                  ]
                : []),
              ...(route.destinationCoordinates
                ? [
                    {
                      type: "Feature",
                      properties: { "marker-color": "#f9735b" },
                      geometry: {
                        type: "Point",
                        coordinates: [
                          route.destinationCoordinates.longitude,
                          route.destinationCoordinates.latitude,
                        ],
                      },
                    },
                  ]
                : []),
            ],
          }),
        )})/auto/800x520?padding=40&access_token=${encodeURIComponent(token ?? "")}`
      : null;

  useEffect(() => {
    if (
      !hasLiveGeometry ||
      !mapContainer.current ||
      mapRef.current ||
      !route ||
      !token
    )
      return;
    mapboxgl.accessToken = token;
    const container = mapContainer.current;
    const bounds = new mapboxgl.LngLatBounds();
    (route.geometry as RouteLineGeometry).coordinates.forEach((point) =>
      bounds.extend(point),
    );
    const fitRoute = (map: mapboxgl.Map) => {
      if (!bounds.isEmpty())
        map.fitBounds(bounds, { padding: 50, duration: 0 });
    };
    let disposed = false;
    const initialize = () => {
      if (
        disposed ||
        container.clientWidth === 0 ||
        container.clientHeight === 0
      )
        return;
      if (mapRef.current) {
        mapRef.current.resize();
        fitRoute(mapRef.current);
        return;
      }
      let map: mapboxgl.Map;
      try {
        map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/light-v11",
          center: [
            route.originCoordinates?.longitude ?? -74,
            route.originCoordinates?.latitude ?? 40.7,
          ],
          zoom: 6,
          attributionControl: true,
        });
      } catch (error) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Mapbox failed to load the map",
        );
        return;
      }
      mapRef.current = map;
      map.on("error", (event) => {
        setMapError(event.error?.message ?? "Mapbox failed to load the map");
      });
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: true }),
        "top-right",
      );
      map.on("load", () => {
        setMapError(null);
        map.resize();
        map.addSource("moveflow-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: route.geometry as RouteLineGeometry,
          },
        });
        map.addLayer({
          id: "moveflow-route-line",
          type: "line",
          source: "moveflow-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#152b2b",
            "line-width": 5,
            "line-opacity": 0.9,
          },
        });
        fitRoute(map);
        if (route.originCoordinates) {
          const marker = new mapboxgl.Marker({ color: "#152b2b" })
            .setLngLat([
              route.originCoordinates.longitude,
              route.originCoordinates.latitude,
            ])
            .setPopup(
              new mapboxgl.Popup({ className: "text-[#292827]" }).setText(
                `Origin: ${route.origin}`,
              ),
            )
            .addTo(map);
          marker
            .getElement()
            .setAttribute("aria-label", `Origin: ${route.origin}`);
        }
        if (route.destinationCoordinates) {
          const marker = new mapboxgl.Marker({ color: "#f9735b" })
            .setLngLat([
              route.destinationCoordinates.longitude,
              route.destinationCoordinates.latitude,
            ])
            .setPopup(
              new mapboxgl.Popup({ className: "text-[#292827]" }).setText(
                `Destination: ${route.destination}`,
              ),
            )
            .addTo(map);
          marker
            .getElement()
            .setAttribute("aria-label", `Destination: ${route.destination}`);
        }
      });
    };
    const resizeObserver = new ResizeObserver(initialize);
    resizeObserver.observe(container);
    initialize();
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [hasLiveGeometry, route, token]);

  return (
    <Card className="gap-0 overflow-hidden rounded-xl bg-card py-0">
      <CardHeader className="gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Route
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Driving route
          </CardTitle>
          <Badge variant="secondary">
            {route
              ? route.status === "live"
                ? "Mapbox route"
                : "Demo estimate"
              : "Route unavailable"}
          </Badge>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Origin", route?.origin, "bg-[#152b2b] dark:bg-[#b7d9d0]"],
            ["Destination", route?.destination, "bg-[#f9735b]"],
          ].map(([label, location, color]) => (
            <div key={label} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${color}`}
                />
                {label}
              </dt>
              <dd className="mt-1 text-sm font-medium leading-5">
                {location ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      </CardHeader>
      <CardContent className="px-0">
        {/* A definite viewport height lets Mapbox's relative host fill it. */}
        <div className="relative h-[460px] w-full bg-[#dfe9e6] dark:bg-[#173638] sm:h-[520px]">
          <div
            ref={mapContainer}
            className={hasLiveGeometry ? "relative z-10 size-full" : "hidden"}
          />
          {staticMapUrl && (
            <img
              src={staticMapUrl}
              alt="Map showing the relocation route"
              className="absolute inset-0 z-0 size-full object-cover"
            />
          )}
          {mapError && (
            <div
              role="status"
              className="absolute inset-x-5 bottom-5 z-20 rounded-md bg-black/75 px-3 py-2 text-xs text-white"
            >
              {mapError}
            </div>
          )}
          {!hasLiveGeometry && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <Route
                aria-hidden="true"
                className="size-6 text-muted-foreground"
              />
              <p className="text-sm font-medium">Map preview unavailable</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {route?.status === "fallback"
                  ? "Live routing is unavailable. The figures below are demo estimates, not calculated for this route."
                  : "An interactive map is not available for this route."}
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t px-4 py-3">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Distance</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">
              {route
                ? `${route.distanceMiles.toLocaleString("en-US")} miles`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Estimated driving time
            </dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">
              {duration}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kilometers</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">
              {route
                ? `${Math.round(route.distanceMiles * 1.609344).toLocaleString("en-US")} km`
                : "—"}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          {route
            ? `Source: ${route.source}. ${route.status === "live" ? "Driving estimate; allow extra time for stops and delays." : "Demo figures; actual distance and time may differ."}`
            : "No route data loaded."}
        </p>
      </CardFooter>
    </Card>
  );
}
