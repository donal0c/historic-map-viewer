import { describe, expect, it } from "vitest";
import { decodeHash, decodeHeritageSourceIds, encodeHash } from "./hash";
import type { MapState } from "../types";

const state: MapState = {
  center: [53.3498, -6.2603],
  zoom: 14,
  activeLayerId: "6inch-2nd",
  basemapId: "light",
  opacity: 0.62,
  mode: "swipe",
  blendMode: "multiply",
};

describe("share hash", () => {
  it("round-trips map state and compact evidence source codes", () => {
    const hash = encodeHash(state, ["smr", "wrecks", "canals"]);

    expect(decodeHash(hash)).toEqual(state);
    expect(decodeHeritageSourceIds(hash)).toEqual(["smr", "wrecks", "canals"]);
    expect(hash.length).toBeLessThan(100);
  });

  it("ignores invalid evidence source codes", () => {
    expect(
      decodeHeritageSourceIds(
        "#53,-6,10,6inch-1st,osm,0.7,overlay,normal,zzz",
      ),
    ).toBeNull();
  });

  it("round-trips an optional searched place label", () => {
    const labelled = { ...state, placeLabel: "Ballinasloe, County Galway" };
    expect(decodeHash(encodeHash(labelled))).toEqual(labelled);
  });
});
