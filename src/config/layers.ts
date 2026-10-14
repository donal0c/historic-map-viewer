import type { TileLayerConfig } from "../types";

export const historicalLayers: TileLayerConfig[] = [
  {
    id: "6inch-1st",
    name: "6-Inch 1st Edition (1829–1842)",
    description:
      "OS Ireland 6-Inch County Series, 1st edition. Detailed survey at 1:10,560. Zoom in to see tiles (z10+).",
    url: "",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 16,
    minZoom: 10,
    composite: "6inch-1st",
  },
  {
    id: "6inch-2nd",
    name: "6-Inch 2nd Edition (1888–1913)",
    description:
      "OS Ireland 6-Inch County Series, 2nd/revised edition. Detailed survey at 1:10,560. Zoom in to see tiles (z10+).",
    url: "",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 16,
    minZoom: 10,
    composite: "6inch-2nd",
  },
  {
    id: "ireland-1inch-1st",
    name: "1-Inch Ireland (1859–1917)",
    description:
      "OS Ireland One-Inch (1:63,360) engraved topographic series, published 1859–1917, with hill shading. All-Ireland coverage.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_1st_hills/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 15,
  },
  {
    id: "ireland-1inch-2nd",
    name: "1-Inch 2nd Edition (1898–1902)",
    description:
      "OS Ireland One-Inch (1:63,360) 2nd edition, published 1898–1902, with contour lines. All-Ireland coverage.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_2nd_contours/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 15,
  },
  {
    id: "gsgs4136",
    name: "War Office 1-Inch (1940–42)",
    description:
      "British War Office GSGS 4136, One-Inch (1:63,360) maps of Ireland, 1940–1942.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/ireland/gsgs4136/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 14,
  },
  {
    id: "bartholomew",
    name: "Bartholomew ¼-Inch (1940)",
    description:
      "Bartholomew Quarter-Inch (1:253,440) map of Ireland, c. 1940. Best at lower zoom levels.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/ireland/bartholomew/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 12,
  },
];

export const basemapLayers: TileLayerConfig[] = [
  {
    id: "osm",
    name: "OpenStreetMap",
    description: "Standard OpenStreetMap tiles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    // CARTO's keyless raster basemaps now return an "API KEY REQUIRED"
    // placeholder, so the quiet canvases come from Esri's public tile services.
    id: "light",
    name: "Light",
    description: "Esri World Light Gray Canvas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
  {
    id: "dark",
    name: "Dark",
    description: "Esri World Dark Gray Canvas",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
  {
    id: "satellite",
    name: "Satellite",
    description: "ESRI World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
];

export function findLayer(
  id: string,
  layers: TileLayerConfig[]
): TileLayerConfig | undefined {
  return layers.find((l) => l.id === id);
}

export function layerSupportsZoom(
  layer: TileLayerConfig,
  zoom: number,
): boolean {
  return zoom >= (layer.minZoom ?? 0) && zoom <= layer.maxZoom;
}

/** Representative survey year for each series, used to find the nearest era. */
const HISTORICAL_ERA_YEAR: Record<string, number> = {
  "6inch-1st": 1836,
  "ireland-1inch-1st": 1888,
  "6inch-2nd": 1900,
  "ireland-1inch-2nd": 1900,
  bartholomew: 1940,
  gsgs4136: 1941,
};

const DETAILED_ZOOM = 13;

/**
 * Returns the historical layer to show at `zoom`. The preferred layer wins
 * whenever it is drawn at that zoom. Otherwise the nearest era that is drawn
 * takes over; at street scale the detailed six-inch county sheets are
 * preferred over an over-zoomed one-inch sheet, so a place search or a deep
 * zoom never lands on an empty or illegible historical pane.
 */
export function bestLayerForZoom(zoom: number, preferredId: string): string {
  const preferred = findLayer(preferredId, historicalLayers);
  if (preferred && layerSupportsZoom(preferred, zoom)) return preferredId;

  const preferredYear = HISTORICAL_ERA_YEAR[preferredId] ?? 1900;
  const candidates = historicalLayers
    .filter((layer) => layerSupportsZoom(layer, zoom))
    .map((layer) => ({
      id: layer.id,
      scalePenalty: zoom >= DETAILED_ZOOM && !layer.composite ? 1 : 0,
      distance: Math.abs((HISTORICAL_ERA_YEAR[layer.id] ?? 1900) - preferredYear),
      completeness: layer.id === "6inch-2nd" ? 0 : 1,
    }))
    .sort(
      (left, right) =>
        left.scalePenalty - right.scalePenalty ||
        left.distance - right.distance ||
        left.completeness - right.completeness,
    );
  return candidates[0]?.id ?? preferredId;
}

/** Clamps a zoom into the range a historical layer is drawn at. */
export function clampZoomToLayer(layer: TileLayerConfig, zoom: number): number {
  return Math.min(layer.maxZoom, Math.max(layer.minZoom ?? 0, zoom));
}
