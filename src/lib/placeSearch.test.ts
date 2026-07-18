import { beforeEach, expect, test, vi } from "vitest";
import {
  clearPlaceSearchCache,
  normalizePlaceName,
  readRecentSearches,
  rememberSearch,
  searchLocalPlaces,
} from "./placeSearch";

const records = [
  ["1", "Baile An Teampaill", "Baile An Teampaill", "Gaillimh", "Gaillimh", 53.3, -8.4],
  ["2", "Ballymore", "An Baile Mór", "Westmeath", "An Iarmhí", 53.49, -7.68],
  ["3", "Baunreagh", "An Bán Riabhach", "Laois", "Laois", 52.98, -7.4],
] as const;

beforeEach(() => clearPlaceSearchCache());

test("normalises Irish names without losing search intent", () => {
  expect(normalizePlaceName("Áth Cliath")).toBe("ath cliath");
});

test("searches English and Irish names from one lazy chunk", async () => {
  const fetcher = vi.fn(async () =>
    new Response(JSON.stringify(records), { status: 200 }),
  ) as unknown as typeof fetch;

  const english = await searchLocalPlaces("Ballym", fetcher);
  const irish = await searchLocalPlaces("Baile Mór", fetcher);

  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(english[0]).toMatchObject({
    label: "Ballymore",
    source: "gazetteer",
  });
  expect(irish[0]).toMatchObject({
    label: "An Baile Mór",
    detail: expect.stringContaining("Ballymore"),
  });
});

test("stores a bounded, deduplicated recent-search list", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const result = {
    id: "one",
    label: "Glendalough",
    detail: "County Wicklow",
    lat: 53.01,
    lng: -6.33,
  };

  rememberSearch(result, storage);
  rememberSearch({ ...result, id: "two" }, storage);

  expect(readRecentSearches(storage)).toEqual([
    expect.objectContaining({ id: "two", label: "Glendalough", source: "recent" }),
  ]);
});
