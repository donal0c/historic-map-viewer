export interface PlaceContextImage {
  url: string;
  sourceUrl: string;
  artist: string;
  credit?: string;
  licence: string;
  licenceUrl: string;
}

export interface PlaceContext {
  title: string;
  summary: string;
  pageUrl: string;
  wikidataUrl?: string;
  distanceMeters: number;
  matchedBy: "name" | "proximity";
  image?: PlaceContextImage;
}

export interface ContextCandidate {
  pageid: number;
  title: string;
  extract?: string;
  fullurl?: string;
  pageimage?: string;
  pageprops?: { wikibase_item?: string };
  coordinates?: Array<{ lat?: number; lon?: number }>;
}

export function selectContextCandidate(
  candidates: ContextCandidate[],
  label: string | undefined,
  center: [number, number],
): { candidate: ContextCandidate; distanceMeters: number; matchedBy: "name" | "proximity" } | null {
  const ranked = candidates
    .map((candidate) => {
      const coordinate = candidate.coordinates?.[0];
      const distanceMeters =
        typeof coordinate?.lat === "number" && typeof coordinate.lon === "number"
          ? haversineMeters(center, [coordinate.lat, coordinate.lon])
          : Number.POSITIVE_INFINITY;
      const nameScore = label ? placeNameScore(label, candidate.title) : 0;
      return { candidate, distanceMeters, nameScore };
    })
    .filter(({ candidate }) => Boolean(candidate.extract && candidate.fullurl))
    .sort(
      (left, right) =>
        right.nameScore - left.nameScore ||
        left.distanceMeters - right.distanceMeters,
    );

  const best = ranked[0];
  if (!best) return null;

  if (label) {
    const normalisedLabel = normalisePlaceName(label);
    const normalisedTitle = normalisePlaceName(best.candidate.title);
    const candidateIsTheNamedPlace =
      normalisedLabel === normalisedTitle ||
      normalisedLabel.includes(normalisedTitle);
    if (
      !candidateIsTheNamedPlace ||
      best.nameScore < 0.58 ||
      best.distanceMeters > 8_000
    ) {
      return null;
    }
    return { ...best, matchedBy: "name" };
  }

  if (best.distanceMeters > 1_000) return null;
  return { ...best, matchedBy: "proximity" };
}

export function placeNameScore(label: string, title: string): number {
  const left = normalisePlaceName(label);
  const right = normalisePlaceName(title);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.82;

  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return common / Math.max(leftTokens.size, rightTokens.size);
}

export function normalisePlaceName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(county|co|ireland|republic of)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function haversineMeters(
  first: [number, number],
  second: [number, number],
): number {
  const radians = Math.PI / 180;
  const deltaLat = (second[0] - first[0]) * radians;
  const deltaLng = (second[1] - first[1]) * radians;
  const firstLat = first[0] * radians;
  const secondLat = second[0] * radians;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(firstLat) * Math.cos(secondLat) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
