import type { SearchResult } from "../types";
import { notablePlaces } from "../data/notablePlaces";

type PlaceRecord = [
  id: string,
  englishName: string,
  irishName: string,
  county: string,
  countyIrish: string,
  lat: number,
  lng: number,
];

const chunkCache = new Map<string, Promise<PlaceRecord[]>>();
const RECENT_SEARCHES_KEY = "historic-map-viewer:recent-searches";
const MAX_RECENT_SEARCHES = 5;

export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-IE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAX_NOTABLE_RESULTS = 3;
const MAX_LOCAL_RESULTS = 8;

/**
 * Well-known towns, cities, and heritage sites rank ahead of the townland
 * gazetteer, so "Glendalough" opens the monastic valley rather than a
 * same-named townland in another county.
 */
export function searchNotablePlaces(query: string): SearchResult[] {
  const normalizedQuery = normalizePlaceName(query);
  if (normalizedQuery.length < 2) return [];
  return notablePlaces
    .flatMap((place) => {
      const score = Math.min(
        matchScore(normalizePlaceName(place.name), normalizedQuery),
        ...place.aliases.map((alias) =>
          matchScore(normalizePlaceName(alias), normalizedQuery),
        ),
      );
      if (!Number.isFinite(score)) return [];
      return [{ place, score }];
    })
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.place.name.localeCompare(right.place.name, "en-IE"),
    )
    .slice(0, MAX_NOTABLE_RESULTS)
    .map(({ place }) => ({
      id: `notable-${place.id}`,
      label: place.name,
      detail: `${place.kind} · County ${place.county}`,
      lat: place.lat,
      lng: place.lng,
      source: "curated" as const,
    }));
}

export async function searchLocalPlaces(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<SearchResult[]> {
  const normalizedQuery = normalizePlaceName(query);
  const chunkKey = normalizedQuery[0];
  if (normalizedQuery.length < 2 || !chunkKey || !/^[a-z]$/.test(chunkKey)) {
    return [];
  }

  const notable = searchNotablePlaces(query);
  const records = await loadChunk(chunkKey, fetcher);
  const matches = records
    .flatMap((record) => {
      const english = normalizePlaceName(record[1]);
      const irish = normalizePlaceName(record[2]);
      const englishScore = matchScore(english, normalizedQuery);
      const irishScore = matchScore(irish, normalizedQuery);
      const score = Math.min(englishScore, irishScore);
      if (!Number.isFinite(score)) return [];

      const irishMatch = irishScore < englishScore;
      const primaryName = irishMatch ? record[2] : record[1];
      const alternateName = irishMatch ? record[1] : record[2];
      const county = irishMatch ? record[4] || record[3] : record[3];
      const detail = [
        alternateName && normalizePlaceName(alternateName) !== normalizePlaceName(primaryName)
          ? alternateName
          : undefined,
        irishMatch ? "Baile fearainn" : "Townland",
        county ? `${irishMatch ? "Contae" : "County"} ${county}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ");

      return [{
        result: {
          id: `gazetteer-${record[0]}`,
          label: primaryName,
          detail,
          lat: record[5],
          lng: record[6],
          source: "gazetteer" as const,
        },
        score,
        name: primaryName,
      }];
    })
    .sort((left, right) =>
      left.score - right.score ||
      left.name.localeCompare(right.name, "en-IE"),
    )
    .slice(0, MAX_LOCAL_RESULTS - notable.length)
    .map(({ result }) => result);
  return [...notable, ...disambiguateDuplicatePlaces(matches)];
}

function loadChunk(key: string, fetcher: typeof fetch) {
  const cached = chunkCache.get(key);
  if (cached) return cached;

  const request = fetcher(`/data/places/${key}.json`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Irish placename index failed (${response.status})`);
    }
    return (await response.json()) as PlaceRecord[];
  });
  chunkCache.set(key, request);
  request.catch(() => chunkCache.delete(key));
  return request;
}

function matchScore(value: string, query: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  if (value === query) return 0;
  if (value.startsWith(query)) return 1 + (value.length - query.length) / 1_000;
  const wordIndex = value.indexOf(` ${query}`);
  if (wordIndex >= 0) return 2 + wordIndex / 1_000;
  const containsIndex = value.indexOf(query);
  if (containsIndex >= 0) return 3 + containsIndex / 1_000;
  return Number.POSITIVE_INFINITY;
}

function disambiguateDuplicatePlaces(results: SearchResult[]) {
  const counts = new Map<string, number>();
  for (const result of results) {
    const key = `${normalizePlaceName(result.label)}:${normalizePlaceName(result.detail)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return results.map((result) => {
    const key = `${normalizePlaceName(result.label)}:${normalizePlaceName(result.detail)}`;
    if ((counts.get(key) ?? 0) < 2) return result;
    return {
      ...result,
      detail: `${result.detail} · ${formatCoordinate(result.lat, "N", "S")}, ${formatCoordinate(result.lng, "E", "W")}`,
    };
  });
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

export function readRecentSearches(storage: Pick<Storage, "getItem"> = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value
      .filter(isStoredSearchResult)
      .slice(0, MAX_RECENT_SEARCHES)
      .map((result) => ({ ...result, source: "recent" as const }));
  } catch {
    return [];
  }
}

export function rememberSearch(
  result: SearchResult,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const next = [
    { ...result, source: result.source === "recent" ? undefined : result.source },
    ...readRecentSearches(storage).filter(
      (recent) =>
        recent.id !== result.id &&
        normalizePlaceName(recent.label) !== normalizePlaceName(result.label),
    ),
  ].slice(0, MAX_RECENT_SEARCHES);
  storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

function isStoredSearchResult(value: unknown): value is SearchResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<SearchResult>;
  return (
    typeof result.id === "string" &&
    typeof result.label === "string" &&
    typeof result.detail === "string" &&
    typeof result.lat === "number" &&
    typeof result.lng === "number"
  );
}

export function clearPlaceSearchCache() {
  chunkCache.clear();
}
