import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet-side-by-side";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageFeature, MapState } from "../../types";
import { historicalLayers, basemapLayers, findLayer } from "../../config/layers";
import { createHistoricalLayer } from "../../lib/createHistoricalLayer";
import { addHeritageLayerToMap } from "../../lib/mapHeritageLayer";

interface SwipeModeProps {
  state: MapState;
  heritageData: HeritageData;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function SwipeMode({
  state,
  heritageData,
  onViewChange,
  onSelectFeature,
}: SwipeModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const histTileRef = useRef<L.TileLayer | null>(null);
  const controlRef = useRef<L.Control | null>(null);
  const heritageRef = useRef<L.LayerGroup | null>(null);
  const isExternalUpdate = useRef(false);

  const basemap =
    findLayer(state.basemapId, basemapLayers) ?? basemapLayers[0];
  const historical =
    findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];

  const handleMoveEnd = useCallback(() => {
    if (isExternalUpdate.current || !mapRef.current) return;
    const c = mapRef.current.getCenter();
    onViewChange([c.lat, c.lng], mapRef.current.getZoom());
  }, [onViewChange]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(state.center, state.zoom);
    mapRef.current = map;
    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("moveend", handleMoveEnd);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync view from state
  useEffect(() => {
    if (!mapRef.current) return;
    isExternalUpdate.current = true;
    mapRef.current.setView(state.center, state.zoom);
    const timer = setTimeout(() => {
      isExternalUpdate.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [state.center, state.zoom]);

  // Update layers + side-by-side control
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (controlRef.current) {
      controlRef.current.remove();
      controlRef.current = null;
    }
    if (baseTileRef.current) {
      baseTileRef.current.remove();
      baseTileRef.current = null;
    }
    if (histTileRef.current) {
      histTileRef.current.remove();
      histTileRef.current = null;
    }

    const baseLayer = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    }).addTo(map);

    const histLayer = createHistoricalLayer(historical);
    histLayer.addTo(map);

    baseTileRef.current = baseLayer;
    histTileRef.current = histLayer;

    const ctrl = L.control.sideBySide(baseLayer, histLayer);
    ctrl.addTo(map);
    controlRef.current = ctrl;

    return () => {
      ctrl.remove();
      histLayer.remove();
      baseLayer.remove();
    };
  }, [basemap, historical]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    heritageRef.current?.remove();
    heritageRef.current = addHeritageLayerToMap(
      map,
      heritageData,
      onSelectFeature
    );

    return () => {
      heritageRef.current?.remove();
      heritageRef.current = null;
    };
  }, [heritageData, onSelectFeature]);

  return <div ref={containerRef} className="h-full w-full" />;
}
