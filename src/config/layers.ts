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
    name: "1-Inch 1st Edition (Hills)",
    description:
      "OS Ireland One-Inch (1:63,360) 1st edition with hill shading. All-Ireland coverage.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_1st_hills/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 15,
  },
  {
    id: "ireland-1inch-2nd",
    name: "1-Inch 2nd Edition (Contours)",
    description:
      "OS Ireland One-Inch (1:63,360) 2nd edition with contour lines. All-Ireland coverage.",
    url: "https://mapseries-tilesets.s3.amazonaws.com/os/ireland_1inch_2nd_contours/{z}/{x}/{y}.png",
    attribution:
      'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    maxZoom: 15,
  },
  {
    id: "gsgs4136",
    name: "War Office 1-Inch (1941–43)",
    description:
      "British War Office GSGS 4136, One-Inch (1:63,360) maps of Ireland, 1941–1943.",
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
    id: "light",
    name: "Light",
    description: "CartoDB Positron (light theme)",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
  },
  {
    id: "dark",
    name: "Dark",
    description: "CartoDB Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 20,
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
