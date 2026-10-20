import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/providers/mapbox", () => ({
  geocodeMapboxPlace: vi.fn(async (city: string) => ({
    latitude: city === "Boston" ? 42 : 34,
    longitude: -71,
  })),
}));

import { searchFlightConnections } from "@/lib/providers/airlabs";

const input = {
  origin: "Boston",
  destination: "Los Angeles",
  departureDate: "2026-10-19",
};
const direct = {
  dep_iata: "BOS",
  arr_iata: "LAX",
  flight_iata: "AA10",
  airline_iata: "AA",
  days: ["mon"],
  dep_time: "08:00",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AirLabs route suggestions", () => {
  it("reports a missing key without requesting data", async () => {
    vi.stubEnv("AIRLABS_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchFlightConnections(input);
    expect(result.status).toBe("fallback");
    expect(result.isDemoData).toBe(true);
    expect(result.connections.map((connection) => connection.stops)).toEqual([
      0, 1,
    ]);
    expect(result.warning).toContain("fictional");
    expect(result.warning).toContain("AIRLABS_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("matches direct and potential one-stop routes and filters first-leg days", async () => {
    vi.stubEnv("AIRLABS_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const request = new URL(url);
        if (request.pathname.endsWith("/nearby")) {
          return Response.json({
            response: {
              airports: [
                {
                  iata_code:
                    request.searchParams.get("lat") === "42" ? "BOS" : "LAX",
                },
              ],
            },
          });
        }
        const dep = request.searchParams.get("dep_iata");
        const arr = request.searchParams.get("arr_iata");
        if (dep && arr)
          return Response.json({
            response: [
              direct,
              { ...direct, flight_iata: "AA11", days: ["tue"] },
            ],
          });
        if (dep)
          return Response.json({
            response: [
              { dep_iata: "BOS", arr_iata: "ORD", flight_iata: "AA20" },
            ],
          });
        return Response.json({
          response: [
            {
              dep_iata: "ORD",
              arr_iata: "LAX",
              flight_iata: "AA30",
              days: ["wed"],
            },
          ],
        });
      }),
    );
    const result = await searchFlightConnections(input);
    expect(result.status).toBe("live");
    expect(result.connections.map((connection) => connection.stops)).toEqual([
      0, 1,
    ]);
    expect(result.connections[0]?.segments[0]?.departureTime).toBe("08:00");
    expect(result.connections[1]?.layoverMinutes).toBeUndefined();
    expect(result.warning).toContain("not confirmed");
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("only searches direct routes when maxStops is zero", async () => {
    vi.stubEnv("AIRLABS_API_KEY", "test-secret");
    const fetchMock = vi.fn(async (url: string) => {
      const request = new URL(url);
      if (request.pathname.endsWith("/nearby"))
        return Response.json({
          airports: [
            {
              iata_code:
                request.searchParams.get("lat") === "42" ? "BOS" : "LAX",
            },
          ],
        });
      return Response.json([direct]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await searchFlightConnections({ ...input, maxStops: 0 });
    expect(result.connections).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sanitizes provider errors, including errors returned with HTTP 200", async () => {
    vi.stubEnv("AIRLABS_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: { message: "test-secret" } })),
    );
    const result = await searchFlightConnections(input);
    expect(result.status).toBe("fallback");
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });

  it("does not treat a malformed route response as an empty result", async () => {
    vi.stubEnv("AIRLABS_API_KEY", "test-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const request = new URL(url);
        if (request.pathname.endsWith("/nearby"))
          return Response.json({
            response: {
              airports: [
                {
                  iata_code:
                    request.searchParams.get("lat") === "42" ? "BOS" : "LAX",
                },
              ],
            },
          });
        return Response.json({ response: {} });
      }),
    );
    const result = await searchFlightConnections({ ...input, maxStops: 0 });
    expect(result.status).toBe("fallback");
    expect(result.connections).toHaveLength(1);
    expect(result.warning).toContain("invalid routes response");
  });
});
