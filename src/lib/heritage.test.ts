import { describe, expect, it } from "vitest";
import { deduplicateHeritageFeatures } from "./heritage";
import type { HeritageFeature, HeritageLayerId } from "../types";

function feature(
  id: string,
  layer: HeritageLayerId,
  smrs: string,
  detail = "",
): HeritageFeature {
  return {
    id,
    layer,
    title: "Recorded site",
    subtitle: smrs,
    detail,
    coordinates: [53.5, -8],
    raw: { SMRS: smrs },
    geometry: { type: "Point", coordinates: [-8, 53.5] },
  };
}

describe("deduplicateHeritageFeatures", () => {
  it("merges a themed NMS record with its core SMR record", () => {
    const result = deduplicateHeritageFeatures([
      feature("smr-1", "smr", "RO012-003---", "Richer statutory description"),
      feature("well-1", "holy-wells", "RO012003"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("smr-1");
    expect(result[0]?.relatedRecords).toEqual([
      expect.objectContaining({ layer: "holy-wells" }),
    ]);
  });

  it("preserves records from different evidence families", () => {
    const result = deduplicateHeritageFeatures([
      feature("smr-1", "smr", "RO012-003---"),
      feature("excavation-1", "excavations", "RO012-003---"),
    ]);

    expect(result).toHaveLength(2);
  });
});
