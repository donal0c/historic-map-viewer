import { describe, expect, it } from "vitest";
import { clearBlackNodataPixels } from "./compositeLayer";

describe("clearBlackNodataPixels", () => {
  it("makes exact black pixels transparent without erasing dark map ink", () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 255,
      1, 0, 0, 255,
      32, 26, 20, 255,
      244, 231, 198, 255,
    ]);

    clearBlackNodataPixels(pixels);

    expect([...pixels]).toEqual([
      0, 0, 0, 0,
      1, 0, 0, 255,
      32, 26, 20, 255,
      244, 231, 198, 255,
    ]);
  });
});
