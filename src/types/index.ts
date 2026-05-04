import type { LatLngTuple } from "leaflet";

export type ViewMode = "overlay" | "swipe" | "side-by-side" | "spyglass";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light";

export type HeritageLayerId = "smr" | "niah" | "excavations" | "zones";

export interface SearchResult {
  id: string;
  label: string;
  detail: string;
  lat: number;
  lng: number;
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
}

export interface HeritageData {
  features: HeritageFeature[];
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  updatedAt?: string;
  radiusMeters: number;
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
  activeLayerId: string;
  basemapId: string;
  opacity: number;
  mode: ViewMode;
  blendMode: BlendMode;
}
