import type { LatLngTuple, LatLngBoundsLiteral } from "leaflet";

export const DEFAULT_CENTER: LatLngTuple = [53.5, -8.0];
export const DEFAULT_ZOOM = 8;

// Rough bounding box for the island of Ireland
export const IRELAND_BOUNDS: LatLngBoundsLiteral = [
  [51.35, -10.7], // SW
  [55.45, -5.3],  // NE
];
