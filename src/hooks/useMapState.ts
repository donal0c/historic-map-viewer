import { useCallback, useState } from "react";
import type { LatLngTuple } from "leaflet";
import type { MapState, ViewMode, BlendMode } from "../types";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "../config/map";
import { historicalLayers, basemapLayers } from "../config/layers";
import { getInitialStateFromHash } from "../lib/hash";

const initialState: MapState = {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  activeLayerId: historicalLayers[0].id,
  basemapId: basemapLayers[0].id,
  opacity: 0.7,
  mode: "overlay",
  blendMode: "normal",
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
      setState((s) => ({ ...s, center, zoom })),
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
