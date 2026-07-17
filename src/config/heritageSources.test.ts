import { describe, expect, it } from "vitest";
import {
  defaultHeritageSourceIds,
  heritagePresets,
  heritageSources,
} from "./heritageSources";

describe("heritage source registry", () => {
  it("contains the complete agreed catalogue with unique public endpoints", () => {
    expect(heritageSources).toHaveLength(27);
    expect(new Set(heritageSources.map((source) => source.id)).size).toBe(27);

    for (const source of heritageSources) {
      expect(source.endpoint).toMatch(/^https:\/\/.+\/query$/);
      expect(source.provider.length).toBeGreaterThan(2);
      expect(source.attribution.length).toBeGreaterThan(2);
      expect(source.titleFields.length).toBeGreaterThan(0);
      expect(source.minZoom).toBeGreaterThanOrEqual(8);
      expect(source.limit).toBeLessThanOrEqual(180);
    }
  });

  it("loads only the three core defaults on first visit", () => {
    expect(defaultHeritageSourceIds).toEqual(["smr", "niah", "excavations"]);
  });

  it("keeps every preset inside the declared registry", () => {
    const known = new Set(heritageSources.map((source) => source.id));
    for (const sourceIds of Object.values(heritagePresets)) {
      expect(sourceIds.length).toBeGreaterThan(0);
      expect(sourceIds.every((id) => known.has(id))).toBe(true);
    }
  });
});
