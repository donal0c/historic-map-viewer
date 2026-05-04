import type { MapState, ViewMode, BlendMode } from "../types";
import { historicalLayers, basemapLayers } from "../config/layers";

const VIEW_MODES: ViewMode[] = ["overlay", "swipe", "side-by-side", "spyglass"];
const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
];

export function encodeHash(state: MapState): string {
  const parts = [
    state.center[0].toFixed(5),
    state.center[1].toFixed(5),
    state.zoom.toString(),
    state.activeLayerId,
    state.basemapId,
    state.opacity.toFixed(2),
    state.mode,
    state.blendMode,
  ];
  return "#" + parts.join(",");
}

export function decodeHash(hash: string): Partial<MapState> | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;

  const parts = raw.split(",");
  if (parts.length < 3) return null;

  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  const zoom = parseInt(parts[2], 10);

  if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return null;

  const result: Partial<MapState> = {
    center: [lat, lng],
    zoom,
  };

  if (parts[3] && historicalLayers.some((l) => l.id === parts[3])) {
    result.activeLayerId = parts[3];
  }
  if (parts[4] && basemapLayers.some((l) => l.id === parts[4])) {
    result.basemapId = parts[4];
  }
  if (parts[5]) {
    const op = parseFloat(parts[5]);
    if (!isNaN(op) && op >= 0 && op <= 1) result.opacity = op;
  }
  if (parts[6] && VIEW_MODES.includes(parts[6] as ViewMode)) {
    result.mode = parts[6] as ViewMode;
  }
  if (parts[7] && BLEND_MODES.includes(parts[7] as BlendMode)) {
    result.blendMode = parts[7] as BlendMode;
  }

  return result;
}

export function getInitialStateFromHash(): Partial<MapState> {
  if (typeof window === "undefined") return {};
  const decoded = decodeHash(window.location.hash);
  return decoded ?? {};
}
