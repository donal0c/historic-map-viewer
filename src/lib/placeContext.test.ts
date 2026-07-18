import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  normalisePlaceName,
  placeNameScore,
  selectContextCandidate,
} from "./placeContext";

const dublin = {
  pageid: 1,
  title: "Dublin",
  extract: "Capital city of Ireland.",
  fullurl: "https://en.wikipedia.org/wiki/Dublin",
  coordinates: [{ lat: 53.3498, lon: -6.2603 }],
};

describe("place context matching", () => {
  it("normalises administrative suffixes and accents", () => {
    expect(normalisePlaceName("Dúblin, County Ireland")).toBe("dublin");
  });

  it("favours direct place-name matches", () => {
    expect(placeNameScore("Medieval Dublin, Ireland", "Dublin")).toBeGreaterThan(0.58);
    expect(
      selectContextCandidate([dublin], "Dublin, Ireland", [53.3438, -6.2675])
        ?.candidate.title,
    ).toBe("Dublin");
  });

  it("rejects a weak named match even when geographically nearby", () => {
    expect(
      selectContextCandidate(
        [{ ...dublin, title: "Trinity College Dublin" }],
        "Glendalough",
        [53.3498, -6.2603],
      ),
    ).toBeNull();
  });

  it("rejects a nearby article that is more specific than a one-word place", () => {
    expect(
      selectContextCandidate(
        [{ ...dublin, title: "City Hall, Dublin" }],
        "Dublin",
        [53.3438, -6.2675],
      ),
    ).toBeNull();
  });

  it("allows only very close proximity matches when there is no label", () => {
    expect(selectContextCandidate([dublin], undefined, [53.349, -6.26])).not.toBeNull();
    expect(selectContextCandidate([dublin], undefined, [53.32, -6.26])).toBeNull();
    expect(haversineMeters([53.3498, -6.2603], [53.3498, -6.2603])).toBe(0);
  });
});
