import { describe, expect, it } from "vitest";
import { atlasStories } from "../data/stories";
import type { MapState } from "../types";
import { buildShareDescriptor } from "./share";

const state: MapState = {
  center: [53.3438, -6.2675],
  zoom: 14,
  activeLayerId: "6inch-1st",
  basemapId: "light",
  opacity: 0.76,
  mode: "overlay",
  blendMode: "multiply",
  placeLabel: "Dublin",
};

describe("designed sharing", () => {
  it("encodes the complete map state into a server-visible sharing URL", () => {
    const share = buildShareDescriptor({
      state,
      enabledSources: ["smr", "niah"],
      origin: "https://example.com",
      pathname: "/",
    });
    expect(share.title).toContain("Dublin");
    expect(share.shareUrl).toContain("/share?");
    expect(new URL(share.shareUrl).searchParams.get("target")).toContain(
      "#53.34380,-6.26750,14,6inch-1st",
    );
  });

  it("uses curated story identity and visual keys", () => {
    const share = buildShareDescriptor({
      state,
      enabledSources: ["smr"],
      story: atlasStories[0],
      stepIndex: 1,
      origin: "https://example.com",
      pathname: "/",
    });
    expect(share.title).toBe("Dublin, redrawn");
    expect(share.visual).toBe("dublin-redrawn");
    expect(share.target).toContain("?story=dublin-redrawn&step=2");
    expect(share.imageUrl).toContain("title=Dublin%2C%20redrawn");
    expect(share.imageUrl).not.toContain("+");
    expect(new URL(share.imageUrl).searchParams.get("title")).toBe(
      "Dublin, redrawn",
    );
  });
});
