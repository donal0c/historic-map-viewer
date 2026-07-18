import { describe, expect, it } from "vitest";
import {
  firstTimeLapseLayerId,
  isUnavailableTimeLapseReadiness,
  isUsableTimeLapseReadiness,
  nextTimeLapseLayerId,
  timeLapseSkipMessage,
} from "./timeLapse";

describe("time-lapse sequence", () => {
  it("uses chronological edition order and skips known unavailable layers", () => {
    expect(nextTimeLapseLayerId("6inch-1st")).toBe("ireland-1inch-1st");
    expect(
      nextTimeLapseLayerId(
        "6inch-1st",
        new Set(["ireland-1inch-1st", "6inch-2nd"]),
      ),
    ).toBe("ireland-1inch-2nd");
    expect(nextTimeLapseLayerId("gsgs4136")).toBeNull();
    expect(firstTimeLapseLayerId(new Set(["6inch-1st"]))).toBe(
      "ireland-1inch-1st",
    );
  });

  it("classifies readiness without treating partial coverage as failure", () => {
    const readiness = {
      layerId: "6inch-1st",
      loadedTiles: 1,
      emptyTiles: 1,
      errorTiles: 0,
      requestedImages: 2,
      message: "",
    };
    expect(
      isUsableTimeLapseReadiness({ ...readiness, status: "partial" }),
    ).toBe(true);
    expect(
      isUnavailableTimeLapseReadiness({
        ...readiness,
        status: "outside-coverage",
      }),
    ).toBe(true);
    expect(
      timeLapseSkipMessage({
        ...readiness,
        status: "unsupported-zoom",
      }),
    ).toContain("current scale");
  });
});
