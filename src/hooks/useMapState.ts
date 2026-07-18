import { useCallback, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { MapState, ViewMode, BlendMode } from "../types";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "../config/map";
import { basemapLayers } from "../config/layers";
import { getInitialStateFromHash } from "../lib/hash";

const initialState: MapState = {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  viewTransition: "instant",
  // The quarter-inch sheet is the most continuous, legible national overview.
  // Detailed county sheets become useful after a place search.
  activeLayerId: "bartholomew",
  basemapId: basemapLayers.find((layer) => layer.id === "light")?.id ??
    basemapLayers[0].id,
  opacity: 0.58,
  mode: "overlay",
  blendMode: "multiply",
};

export function useMapState(initial?: Partial<MapState>) {
  const [state, setState] = useState<MapState>(() => ({
    ...initialState,
    ...initial,
    ...getInitialStateFromHash(),
  }));

  const setCenter = useCallback(
    (center: LatLngTuple) => setState((s) => ({ ...s, center })),
    []
  );

  const setZoom = useCallback(
    (zoom: number) => setState((s) => ({ ...s, zoom })),
    []
  );

  const setActiveLayer = useCallback(
    (activeLayerId: string) => setState((s) => ({ ...s, activeLayerId })),
    []
  );

  const setBasemap = useCallback(
    (basemapId: string) => setState((s) => ({ ...s, basemapId })),
    []
  );

  const setOpacity = useCallback(
    (opacity: number) => setState((s) => ({ ...s, opacity })),
    []
  );

  const setMode = useCallback(
    (mode: ViewMode) => setState((s) => ({ ...s, mode })),
    []
  );

  const setBlendMode = useCallback(
    (blendMode: BlendMode) => setState((s) => ({ ...s, blendMode })),
    []
  );

  const setViewPosition = useCallback(
    (center: LatLngTuple, zoom: number) =>
      setState((s) => ({ ...s, center, zoom, viewTransition: "instant" })),
    []
  );

  return {
    state,
    setState,
    setCenter,
    setZoom,
    setActiveLayer,
    setBasemap,
    setOpacity,
    setMode,
    setBlendMode,
    setViewPosition,
  };
}
