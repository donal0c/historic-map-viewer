import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deduplicateHeritageFeatures,
  searchPlaces,
} from "./heritage";
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

describe("searchPlaces", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the compliant browser Nominatim request when available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            place_id: 1,
            display_name: "Ballinasloe, County Galway, Ireland",
            lat: "53.3302722",
            lon: "-8.2213760",
          },
        ]),
        { status: 200 },
      ),
    );

    await expect(searchPlaces("Ballinasloe")).resolves.toEqual([
      expect.objectContaining({
        label: "Ballinasloe, County Galway",
        lat: 53.3302722,
        lng: -8.221376,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "nominatim.openstreetmap.org/search",
    );
  });

  it("falls back to the same-origin Photon proxy when Nominatim fails", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("Blocked", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              place_id: "R-14583995",
              display_name: "Ballinasloe, County Galway, Ireland",
              lat: "53.3302722",
              lon: "-8.2213760",
            },
          ]),
          { status: 200 },
        ),
      );

    const results = await searchPlaces("Ballinasloe");
    expect(results[0]?.label).toBe("Ballinasloe, County Galway");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "/api/search?q=Ballinasloe",
    );
  });
});
