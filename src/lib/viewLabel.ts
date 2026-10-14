import type { MapState } from "../types";

/**
 * Human label for the current view. Raw coordinates are never shown as a
 * headline: the national overview reads as Ireland and an unnamed close-up
 * reads as the map centre.
 */
export function describeView(
  state: Pick<MapState, "placeLabel" | "zoom">,
): string {
  if (state.placeLabel) return state.placeLabel;
  return state.zoom <= 9 ? "Ireland" : "Map centre";
}

export function formatCentre(center: readonly [number, number]): string {
  return `${center[0].toFixed(3)}°N, ${Math.abs(center[1]).toFixed(3)}°W`;
}
