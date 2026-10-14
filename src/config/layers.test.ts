import { describe, expect, it } from "vitest";
import {
  bestLayerForZoom,
  clampZoomToLayer,
  findLayer,
  historicalLayers,
  layerSupportsZoom,
} from "./layers";

describe("bestLayerForZoom", () => {
  it("keeps the preferred edition while it is drawn at the zoom", () => {
    expect(bestLayerForZoom(11, "bartholomew")).toBe("bartholomew");
    expect(bestLayerForZoom(14, "6inch-1st")).toBe("6inch-1st");
  });

  it("moves a place search from the quarter-inch sheet to the six-inch sheet", () => {
    expect(bestLayerForZoom(14, "bartholomew")).toBe("6inch-2nd");
  });

  it("falls back to the nearest era when zooming out of a six-inch sheet", () => {
    expect(bestLayerForZoom(9, "6inch-1st")).toBe("ireland-1inch-1st");
    expect(bestLayerForZoom(9, "6inch-2nd")).toBe("ireland-1inch-2nd");
  });

  it("prefers the most complete six-inch sheet when eras tie", () => {
    expect(bestLayerForZoom(16, "gsgs4136")).toBe("6inch-2nd");
  });

  it("never returns an undrawn layer when any layer is drawn", () => {
    for (let zoom = 6; zoom <= 16; zoom += 1) {
      for (const layer of historicalLayers) {
        const chosen = findLayer(bestLayerForZoom(zoom, layer.id), historicalLayers);
        expect(chosen && layerSupportsZoom(chosen, zoom)).toBe(true);
      }
    }
  });
});

describe("clampZoomToLayer", () => {
  it("clamps into the drawn range", () => {
    const bartholomew = findLayer("bartholomew", historicalLayers)!;
    const sixInch = findLayer("6inch-2nd", historicalLayers)!;
    expect(clampZoomToLayer(bartholomew, 15)).toBe(12);
    expect(clampZoomToLayer(sixInch, 7)).toBe(10);
    expect(clampZoomToLayer(sixInch, 13)).toBe(13);
  });
});
