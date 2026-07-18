import type { LatLngTuple } from "leaflet";

export type ViewMode = "overlay" | "swipe" | "side-by-side" | "spyglass";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light";

export type HeritageLayerId =
  | "smr"
  | "zones"
  | "urban-zones"
  | "niah"
  | "niah-footprints"
  | "excavations"
  | "holy-wells"
  | "stone-circles"
  | "rock-art"
  | "sweathouses"
  | "historic-graves"
  | "wrecks"
  | "defence"
  | "martello-towers"
  | "ww2-lookouts"
  | "eire-signs"
  | "workhouses"
  | "disused-railways"
  | "canals"
  | "waterways"
  | "historic-towns"
  | "parks-gardens"
  | "conservation-areas"
  | "dublin-medieval"
  | "monuments-to-visit"
  | "community-monuments"
  | "norman-settlements";

export type HeritageGeometryKind = "point" | "line" | "polygon";

export type HeritageCategoryId =
  | "core"
  | "sacred"
  | "maritime-defence"
  | "social-transport"
  | "places";

export interface SearchResult {
  id: string;
  label: string;
  detail: string;
  lat: number;
  lng: number;
  source?: "gazetteer" | "external" | "curated" | "recent" | "geolocation";
}

export interface HeritageFeature {
  id: string;
  layer: HeritageLayerId;
  title: string;
  subtitle: string;
  detail?: string;
  imageUrl?: string;
  sourceUrl?: string;
  coordinates?: [number, number];
  raw: Record<string, unknown>;
  geometry: GeoJsonGeometry;
  relatedRecords?: Array<{
    layer: HeritageLayerId;
    title: string;
    sourceUrl?: string;
  }>;
}

export interface HeritageData {
  features: HeritageFeature[];
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  updatedAt?: string;
  radiusMeters: number;
  sources: Partial<Record<HeritageLayerId, HeritageSourceResult>>;
}

export interface HeritageSourceResult {
  status: "idle" | "loading" | "ready" | "error";
  count: number;
  total?: number;
  truncated?: boolean;
  error?: string;
  updatedAt?: string;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

export interface TileLayerConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom?: number;
  tms?: boolean;
  /** If set, tiles are served via composite county layer, not a simple URL */
  composite?: "6inch-1st" | "6inch-2nd";
}

export interface MapState {
  center: LatLngTuple;
  zoom: number;
  placeLabel?: string;
  activeLayerId: string;
  basemapId: string;
  opacity: number;
  mode: ViewMode;
  blendMode: BlendMode;
}

export type HistoricalLayerStatus =
  | "idle"
  | "unsupported-zoom"
  | "loading"
  | "available"
  | "partial"
  | "outside-coverage"
  | "error";

export interface HistoricalReadiness {
  status: HistoricalLayerStatus;
  layerId: string;
  loadedTiles: number;
  emptyTiles: number;
  errorTiles: number;
  requestedImages: number;
  message: string;
}
