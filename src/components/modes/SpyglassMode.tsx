import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageFeature, MapState } from "../../types";
import { historicalLayers, basemapLayers, findLayer } from "../../config/layers";
import { createHistoricalLayer } from "../../lib/createHistoricalLayer";
import { useSpyglass } from "../../hooks/useSpyglass";
import { addHeritageLayerToMap } from "../../lib/mapHeritageLayer";

interface SpyglassModeProps {
  state: MapState;
  heritageData: HeritageData;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function SpyglassMode({
  state,
  heritageData,
  onViewChange,
  onSelectFeature,
}: SpyglassModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const histTileRef = useRef<L.TileLayer | null>(null);
  const heritageRef = useRef<L.LayerGroup | null>(null);
  const isExternalUpdate = useRef(false);
  const { setTarget } = useSpyglass(containerRef);

  const basemap =
    findLayer(state.basemapId, basemapLayers) ?? basemapLayers[0];
  const historical =
    findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];

  const handleMoveEnd = useCallback(() => {
    if (isExternalUpdate.current || !mapRef.current) return;
    const c = mapRef.current.getCenter();
    onViewChange([c.lat, c.lng], mapRef.current.getZoom());
  }, [onViewChange]);

  // Init map
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

  // Update tile layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseTileRef.current) baseTileRef.current.remove();
    if (histTileRef.current) histTileRef.current.remove();

    const baseTile = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    }).addTo(map);
    baseTileRef.current = baseTile;

    const histTile = createHistoricalLayer(historical);
    histTile.addTo(map);
    histTileRef.current = histTile;

    // Wire up spyglass to the historical layer's container
    const wireSpyglass = () => {
      const el = histTile.getContainer();
      if (el) {
        el.style.mixBlendMode = state.blendMode;
        setTarget(el);
      }
    };

    wireSpyglass();
    histTile.on("load", wireSpyglass);

    return () => {
      histTile.remove();
      baseTile.remove();
    };
  }, [basemap, historical, state.blendMode, setTarget]);

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
