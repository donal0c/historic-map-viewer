import { describe, expect, it } from "vitest";
import {
  nlsCandidateLimit,
  nlsTileCandidates,
  tileGeographicBounds,
} from "./nlsResolver";

function tileFor(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latitudeRadians = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * n,
  );
  return { x, y, z };
}

describe("NLS county resolver", () => {
  it.each([
    ["Dublin", 53.3498, -6.2603, "dublin"],
    ["Cork", 51.8985, -8.4756, "cork"],
    ["Galway", 53.2707, -9.0568, "galway"],
    ["Donegal", 54.95, -7.85, "donegal"],
  ])("prioritises the expected county for %s", (_place, lat, lon, county) => {
    const candidates = nlsTileCandidates("1st", tileFor(lat, lon, 14));
    expect(candidates[0]?.county).toBe(county);
    expect(candidates.length).toBeLessThanOrEqual(nlsCandidateLimit());
  });

  it("returns a bounded shortlist at a county boundary", () => {
    const candidates = nlsTileCandidates(
      "2nd",
      tileFor(53.425, -7.94, 12),
    );
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates.length).toBeLessThanOrEqual(4);
  });

  it("returns no candidates for a tile outside Irish coverage", () => {
    expect(
      nlsTileCandidates("1st", tileFor(50.2, -13.2, 12)),
    ).toEqual([]);
  });

  it("produces valid geographic tile bounds", () => {
    const [west, south, east, north] = tileGeographicBounds(
      tileFor(53.3498, -6.2603, 14),
    );
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(53.3498).toBeGreaterThanOrEqual(south);
    expect(53.3498).toBeLessThanOrEqual(north);
  });

  it("does not let the bad Waterford metadata extent capture northern tiles", () => {
    const candidates = nlsTileCandidates(
      "1st",
      tileFor(54.2, -7.2, 14),
    );
    expect(candidates.map((candidate) => candidate.county)).not.toContain(
      "waterford",
    );
  });
});
