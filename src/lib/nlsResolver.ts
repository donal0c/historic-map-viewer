import {
  NLS_COUNTY_BOUNDS,
  type GeographicBounds,
  type NlsEdition,
} from "../data/nlsCountyBounds";

export interface TileCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface NlsTileCandidate {
  county: string;
  series: string;
  overlap: number;
  url: string;
}

const TILE_SIZE = 256;
const MAX_CANDIDATES = 4;
const S3_BASE = "https://mapseries-tilesets.s3.amazonaws.com/os";

export function tileGeographicBounds({
  x,
  y,
  z,
}: TileCoordinates): GeographicBounds {
  const west = tileXToLongitude(x, z);
  const east = tileXToLongitude(x + 1, z);
  const north = tileYToLatitude(y, z);
  const south = tileYToLatitude(y + 1, z);
  return [west, south, east, north];
}

export function nlsTileCandidates(
  edition: NlsEdition,
  coords: TileCoordinates,
): NlsTileCandidate[] {
  const tileBounds = tileGeographicBounds(coords);

  return Object.entries(NLS_COUNTY_BOUNDS[edition])
    .map(([county, bounds]) => ({
      county,
      overlap: overlapArea(tileBounds, bounds),
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort(
      (left, right) =>
        right.overlap - left.overlap ||
        left.county.localeCompare(right.county),
    )
    .slice(0, MAX_CANDIDATES)
    .map(({ county, overlap }) => {
      const series = edition === "2nd" ? `${county}_2nd` : county;
      return {
        county,
        series,
        overlap,
        url: `${S3_BASE}/${series}/${coords.z}/${coords.x}/${coords.y}.png`,
      };
    });
}

export function nlsCandidateLimit(): number {
  return MAX_CANDIDATES;
}

function overlapArea(
  [aWest, aSouth, aEast, aNorth]: GeographicBounds,
  [bWest, bSouth, bEast, bNorth]: GeographicBounds,
): number {
  const width = Math.max(0, Math.min(aEast, bEast) - Math.max(aWest, bWest));
  const height = Math.max(
    0,
    Math.min(aNorth, bNorth) - Math.max(aSouth, bSouth),
  );
  return width * height;
}

function tileXToLongitude(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileYToLatitude(y: number, zoom: number): number {
  const mercator = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(Math.sinh(mercator));
}

export const NLS_TILE_SIZE = TILE_SIZE;
