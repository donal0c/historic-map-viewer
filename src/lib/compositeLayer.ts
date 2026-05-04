import L from "leaflet";

const S3_BASE = "https://mapseries-tilesets.s3.amazonaws.com/os";

// All Irish county tile set names on NLS S3
const IRISH_COUNTIES_1ST = [
  "antrim", "armagh", "carlow", "cavan", "clare", "cork", "donegal", "down",
  "dublin", "fermanagh", "galway", "kerry", "kildare", "kilkenny", "kings",
  "leitrim", "limerick", "londonderry", "longford", "louth", "mayo", "meath",
  "monaghan", "queens", "roscommon", "sligo", "tipperary", "tyrone",
  "waterford", "westmeath", "wexford", "wicklow",
];

const IRISH_COUNTIES_2ND = IRISH_COUNTIES_1ST.map((c) => `${c}_2nd`);

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
    const urls = counties.map((c) => `${S3_BASE}/${c}/${z}/${x}/${y}.png`);

    let settled = false;

    // Try all county URLs concurrently via <img> loads
    // Create hidden probe images - first one to load wins
    const probes: HTMLImageElement[] = [];

    for (const url of urls) {
      const probe = new Image();
      probe.crossOrigin = "anonymous";

      probe.onload = () => {
        if (settled) return;
        settled = true;
        // Cancel other probes
        for (const p of probes) {
          if (p !== probe) p.src = "";
        }
        tile.src = url;
        done(null, tile);
      };

      probe.onerror = () => {
        // Ignore - another county might have this tile
      };

      probe.src = url;
      probes.push(probe);
    }

    // Timeout: if no county has this tile after 5s, resolve with empty
    setTimeout(() => {
      if (!settled) {
        settled = true;
        for (const p of probes) p.src = "";
        // Return a transparent 1x1 pixel
        tile.src =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        done(null, tile);
      }
    }, 5000);

    return tile;
  };

  return layer;
}
