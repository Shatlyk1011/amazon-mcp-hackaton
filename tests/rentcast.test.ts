import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchHousing } from "@/lib/providers/rentcast";
import { parseUsCityLocation } from "@/lib/us-location";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RENTCAST_API_KEY", "fixture-key");
  vi.stubEnv("NODE_ENV", "development");
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("RentCast search parity between web and MCP", () => {
  it("uses the API in development and sends documented location and range parameters", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "austin-home",
            formattedAddress: "123 Main St, Austin, TX",
            city: "Austin",
            state: "TX",
            price: 2000,
            bedrooms: 2,
            bathrooms: 1,
            latitude: 30.27,
            longitude: -97.74,
          },
        ]),
        { headers: { "content-type": "application/json" } },
      ),
    );
    const result = await searchHousing({
      destination: "Austin, Texas",
      maxRent: 2500,
      bedrooms: 1,
      petFriendly: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("city")).toBe("Austin");
    expect(url.searchParams.get("state")).toBe("TX");
    expect(url.searchParams.get("price")).toBe("0:2500");
    expect(url.searchParams.get("bedrooms")).toBe("1:");
    expect(url.searchParams.has("maxPrice")).toBe(false);
    expect(url.searchParams.has("petsAllowed")).toBe(false);
    expect(result.status).toBe("live");
    expect(result.listings[0]).toMatchObject({
      id: "austin-home",
      isDemoData: false,
    });
  });
  it("normalizes full state names, postal codes and country suffixes", () => {
    expect(parseUsCityLocation("austin, texas, USA")).toEqual({
      city: "Austin",
      state: "TX",
    });
    expect(parseUsCityLocation("Boston, Massachusetts")).toEqual({
      city: "Boston",
      state: "MA",
    });
    expect(parseUsCityLocation("Houston, TX")).toEqual({
      city: "Houston",
      state: "TX",
    });
  });
  it("labels stored fallback homes and never passes them as live rent guidance", async () => {
    vi.stubEnv("RENTCAST_API_KEY", "");
    const result = await searchHousing({ destination: "Austin, Texas" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe("unavailable");
    expect(result.listings.length).toBeGreaterThan(0);
    expect(
      result.listings.every(
        (home) => home.isDemoData && home.availability === "Unknown",
      ),
    ).toBe(true);
    expect(result.listings[0].city).toBe("Houston");
    expect(result.listings[0].fetchedAt).not.toBe(result.fetchedAt);
    expect(
      (await searchHousing({ destination: "Austin, TX", liveOnly: true }))
        .listings,
    ).toEqual([]);
  });
  it("distinguishes a provider error from a successful empty search", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const failed = await searchHousing({ destination: "Austin, Texas" });
    expect(failed.status).toBe("unavailable");
    expect(failed.warning).toContain("401");
    fetchMock.mockResolvedValueOnce(new Response("[]"));
    const empty = await searchHousing({ destination: "Austin, Texas" });
    expect(empty.status).toBe("live");
    expect(empty.listings).toEqual([]);
    expect(empty.warning).toBeUndefined();
  });
});
