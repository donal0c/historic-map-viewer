import L from "leaflet";

const S3_BASE = "https://mapseries-tilesets.s3.amazonaws.com/os";
const EMPTY_TILE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TILE_TIMEOUT_MS = 3500;
const PROBE_BATCH_SIZE = 4;
const MAX_TILE_HINTS = 800;
const MAX_RECENT_COUNTIES = 8;

// All Irish county tile set names on NLS S3
const IRISH_COUNTIES_1ST = [
  "antrim", "armagh", "carlow", "cavan", "clare", "cork", "donegal", "down",
  "dublin", "fermanagh", "galway", "kerry", "kildare", "kilkenny", "kings",
  "leitrim", "limerick", "londonderry", "longford", "louth", "mayo", "meath",
  "monaghan", "queens", "roscommon", "sligo", "tipperary", "tyrone",
  "waterford", "westmeath", "wexford", "wicklow",
];

const IRISH_COUNTIES_2ND = IRISH_COUNTIES_1ST.map((c) => `${c}_2nd`);

interface CountyCache {
  recentCounties: string[];
  tileHints: Map<string, string>;
}

const countyCaches: Record<"1st" | "2nd", CountyCache> = {
  "1st": createCountyCache(),
  "2nd": createCountyCache(),
};

function createCountyCache(): CountyCache {
  return {
    recentCounties: [],
    tileHints: new Map(),
  };
}

function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function rememberHint(cache: CountyCache, key: string, county: string) {
  if (cache.tileHints.has(key)) {
    cache.tileHints.delete(key);
  }
  cache.tileHints.set(key, county);
  if (cache.tileHints.size <= MAX_TILE_HINTS) return;

  const oldestKey = cache.tileHints.keys().next().value;
  if (oldestKey) cache.tileHints.delete(oldestKey);
}

function rememberCounty(cache: CountyCache, county: string, coords: L.Coords) {
  rememberHint(cache, tileKey(coords.z, coords.x, coords.y), county);

  let x = coords.x;
  let y = coords.y;
  for (let z = coords.z - 1; z >= Math.max(coords.z - 2, 0); z -= 1) {
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    rememberHint(cache, tileKey(z, x, y), county);
  }

  cache.recentCounties = [
    county,
    ...cache.recentCounties.filter((value) => value !== county),
  ].slice(0, MAX_RECENT_COUNTIES);
}

function orderedCounties(
  counties: string[],
  cache: CountyCache,
  coords: L.Coords
): string[] {
  const preferred = new Set<string>();

  const exact = cache.tileHints.get(tileKey(coords.z, coords.x, coords.y));
  if (exact) preferred.add(exact);

  let x = coords.x;
  let y = coords.y;
  for (let z = coords.z - 1; z >= Math.max(coords.z - 2, 0); z -= 1) {
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    const parentHint = cache.tileHints.get(tileKey(z, x, y));
    if (parentHint) preferred.add(parentHint);
  }

  for (const county of cache.recentCounties) {
    preferred.add(county);
  }

  const ranked = Array.from(preferred).filter((county) => counties.includes(county));
  const leftovers = counties.filter((county) => !preferred.has(county));
  return [...ranked, ...leftovers];
}

function countyUrl(county: string, coords: L.Coords): string {
  return `${S3_BASE}/${county}/${coords.z}/${coords.x}/${coords.y}.png`;
}

/**
 * Creates a Leaflet TileLayer that composites tiles from multiple NLS
 * per-county tile sets. Each tile request races across all county URLs;
 * the first successful response wins. Failed requests (404) are ignored.
 */
export function createCompositeCountyLayer(
  edition: "1st" | "2nd",
  options?: L.TileLayerOptions
): L.TileLayer {
  const counties = edition === "1st" ? IRISH_COUNTIES_1ST : IRISH_COUNTIES_2ND;
  const cache = countyCaches[edition];

  const layer = new L.TileLayer("", {
    maxZoom: 16,
    minZoom: 10,
    attribution: 'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    ...options,
  });

  // Override createTile to race across county URLs
  (layer as any).createTile = function (
    coords: L.Coords,
    done: (err: Error | null, tile: HTMLImageElement) => void
  ): HTMLImageElement {
    const tile = document.createElement("img");
    tile.alt = "";
    tile.setAttribute("role", "presentation");

    const { x, y, z } = coords;
    void x;
    void y;
    void z;
    const rankedCounties = orderedCounties(counties, cache, coords);

    let settled = false;
    const probes: HTMLImageElement[] = [];
    let timeoutId = 0;

    const finish = (url?: string, county?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      for (const probe of probes) probe.src = "";

      if (url && county) {
        rememberCounty(cache, county, coords);
        tile.src = url;
        done(null, tile);
        return;
      }

      tile.src = EMPTY_TILE_DATA_URL;
      done(null, tile);
    };

    const probeBatch = (offset: number) => {
      if (settled) return;
      if (offset >= rankedCounties.length) {
        finish();
        return;
      }

      const batch = rankedCounties.slice(offset, offset + PROBE_BATCH_SIZE);
      let pending = batch.length;

      for (const county of batch) {
        const url = countyUrl(county, coords);
        const probe = new Image();
        probe.crossOrigin = "anonymous";

        probe.onload = () => finish(url, county);
        probe.onerror = () => {
          pending -= 1;
          if (!settled && pending === 0) {
            probeBatch(offset + PROBE_BATCH_SIZE);
          }
        };

        probe.src = url;
        probes.push(probe);
      }
    };

    timeoutId = window.setTimeout(() => finish(), TILE_TIMEOUT_MS);
    probeBatch(0);

    return tile;
  };

  return layer;
}
