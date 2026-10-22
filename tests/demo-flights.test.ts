import { describe, expect, it, vi } from "vitest";
import { searchFlightConnections } from "@/lib/providers/demo-flights";

const input = {
  origin: "Boston",
  destination: "Los Angeles",
  departureDate: "2026-10-19",
};

describe("simulated flight examples", () => {
  it("returns clearly labeled fictional direct and one-stop examples without network calls", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    try {
      const result = await searchFlightConnections(input);
      expect(result.status).toBe("fallback");
      expect(result.isDemoData).toBe(true);
      expect(result.warning).toContain("made up");
      expect(result.warning).toContain("cannot be booked");
      expect(result.connections.map((connection) => connection.stops)).toEqual([
        0, 1,
      ]);
      expect(result.connections[0]?.segments[0]).toMatchObject({
        originAirport: input.origin,
        destinationAirport: input.destination,
        departureTime: "8:30 AM",
        arrivalTime: "11:30 AM",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("honors the direct-only option", async () => {
    const result = await searchFlightConnections({ ...input, maxStops: 0 });
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0]?.stops).toBe(0);
  });
});
