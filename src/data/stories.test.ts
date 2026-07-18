import { describe, expect, it } from "vitest";
import { heritageSourceById } from "../config/heritageSources";
import { historicalLayers } from "../config/layers";
import { atlasStories, historicalPreviewUrl, readStoryRoute } from "./stories";

describe("atlas stories", () => {
  it("defines three complete, source-backed routes", () => {
    expect(atlasStories).toHaveLength(3);
    for (const story of atlasStories) {
      expect(story.steps.length).toBeGreaterThanOrEqual(3);
      for (const step of story.steps) {
        expect(step.center[0]).toBeGreaterThan(51);
        expect(step.center[0]).toBeLessThan(56);
        expect(
          historicalLayers.some((layer) => layer.id === step.activeLayerId),
        ).toBe(true);
        expect(
          step.enabledSources.every((source) => Boolean(heritageSourceById[source])),
        ).toBe(true);
        expect(step.sourceNote.length).toBeGreaterThan(20);
      }
    }
  });

  it("parses and bounds a deep-linked story step", () => {
    expect(readStoryRoute("?story=dublin-redrawn&step=99")).toEqual({
      storyId: "dublin-redrawn",
      stepIndex: 2,
    });
    expect(readStoryRoute("?story=missing&step=1")).toBeNull();
  });

  it("builds a real historical tile preview", () => {
    expect(historicalPreviewUrl(53.3438, -6.2675)).toContain(
      "/ireland_1inch_1st_hills/12/1976/1327.png",
    );
  });
});
