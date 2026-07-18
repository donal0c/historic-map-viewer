import { describe, expect, it } from "vitest";
import type { HeritageFeature } from "../types";
import {
  buildEvidenceCsv,
  buildEvidenceGeoJson,
  buildEvidenceRecords,
  DEFAULT_EVIDENCE_FILTERS,
  featureRepresentativeCoordinates,
  recordIdentifier,
} from "./evidenceBrowser";

const monument: HeritageFeature = {
  id: "smr-DU001",
  layer: "smr",
  title: 'Castle, "upper"',
  subtitle: "DU001 · Dublin",
  sourceUrl: "https://example.com/DU001",
  coordinates: [53.35, -6.26],
  geometry: { type: "Point", coordinates: [-6.26, 53.35] },
  raw: { OBJECTID: 38516, SMRS: "DU001", NOTE: "Line one\nLine two" },
};

const canal: HeritageFeature = {
  id: "canals-12",
  layer: "canals",
  title: "Grand Canal",
  subtitle: "Historic navigation",
  geometry: {
    type: "LineString",
    coordinates: [
      [-6.4, 53.3],
      [-6.2, 53.4],
    ],
  },
  raw: { OBJECTID: 12 },
};

const context = {
  center: [53.35, -6.26] as [number, number],
  radiusMeters: 7000,
  placeLabel: "Dublin",
  exportedAt: "2026-07-18T12:00:00.000Z",
  filters: DEFAULT_EVIDENCE_FILTERS,
  failedSourceIds: ["niah"] as const,
  disabledSourceIds: ["wrecks"] as const,
};

describe("evidence browser records", () => {
  it("uses a geometry bounds centre for route and area records", () => {
    const coordinates = featureRepresentativeCoordinates(canal);
    expect(coordinates?.[0]).toBeCloseTo(53.35);
    expect(coordinates?.[1]).toBeCloseTo(-6.3);
  });

  it("filters across provenance and record identifiers", () => {
    const records = buildEvidenceRecords(
      [monument, canal],
      context.center,
      { ...DEFAULT_EVIDENCE_FILTERS, query: "National Monuments" },
    );
    expect(records.map(({ feature }) => feature.id)).toEqual(["smr-DU001"]);

    const byIdentifier = buildEvidenceRecords(
      [monument, canal],
      context.center,
      { ...DEFAULT_EVIDENCE_FILTERS, query: "DU001" },
    );
    expect(byIdentifier.map(({ feature }) => feature.id)).toEqual(["smr-DU001"]);
  });

  it("sorts nearest first and applies distance limits", () => {
    const records = buildEvidenceRecords(
      [canal, monument],
      context.center,
      { ...DEFAULT_EVIDENCE_FILTERS, maxDistanceMeters: 2000 },
    );
    expect(records.map(({ feature }) => feature.id)).toEqual(["smr-DU001"]);
  });

  it("uses a stable public identifier before the normalised id", () => {
    expect(recordIdentifier(monument)).toBe("DU001");
    expect(recordIdentifier(canal)).toBe("12");
  });
});

describe("evidence snapshot exports", () => {
  const records = buildEvidenceRecords(
    [monument, canal],
    context.center,
    DEFAULT_EVIDENCE_FILTERS,
  );

  it("adds query scope, source health, and provenance to GeoJSON", () => {
    const exported = buildEvidenceGeoJson(records, {
      ...context,
      failedSourceIds: [...context.failedSourceIds],
      disabledSourceIds: [...context.disabledSourceIds],
    });
    expect(exported.metadata.completeness).toContain("not a complete national");
    expect(exported.metadata.failedSources).toContain(
      "National Inventory of Architectural Heritage",
    );
    expect(exported.features[0]?.properties).toMatchObject({
      atlas_source_id: "smr",
      atlas_record_id: "DU001",
      atlas_source_url: "https://example.com/DU001",
    });
  });

  it("produces escaped CSV with snapshot and failure context", () => {
    const csv = buildEvidenceCsv(records, {
      ...context,
      failedSourceIds: [...context.failedSourceIds],
      disabledSourceIds: [...context.disabledSourceIds],
    });
    expect(csv).toContain('"Castle, ""upper"""');
    expect(csv).toContain("View-radius snapshot");
    expect(csv).toContain("National Inventory of Architectural Heritage");
    expect(csv.split("\n")).toHaveLength(3);
  });
});
