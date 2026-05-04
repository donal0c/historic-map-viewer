import { useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet.sync";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageFeature, MapState } from "../../types";
import { historicalLayers, basemapLayers, findLayer } from "../../config/layers";
import { createHistoricalLayer } from "../../lib/createHistoricalLayer";
import { addHeritageLayerToMap } from "../../lib/mapHeritageLayer";

interface SideBySideModeProps {
  state: MapState;
  heritageData: HeritageData;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function SideBySideMode({
  state,
  heritageData,
  onViewChange,
  onSelectFeature,
}: SideBySideModeProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const map1Ref = useRef<L.Map | null>(null);
  const map2Ref = useRef<L.Map | null>(null);
  const baseTile1Ref = useRef<L.TileLayer | null>(null);
  const baseTile2Ref = useRef<L.TileLayer | null>(null);
  const histTileRef = useRef<L.TileLayer | null>(null);
  const heritage1Ref = useRef<L.LayerGroup | null>(null);
  const heritage2Ref = useRef<L.LayerGroup | null>(null);
  const isExternalUpdate = useRef(false);

  const basemap =
    findLayer(state.basemapId, basemapLayers) ?? basemapLayers[0];
  const historical =
    findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];

  const handleMoveEnd = useCallback(() => {
    if (isExternalUpdate.current || !map1Ref.current) return;
    const c = map1Ref.current.getCenter();
    onViewChange([c.lat, c.lng], map1Ref.current.getZoom());
  }, [onViewChange]);

  // Init both maps and sync
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    if (map1Ref.current) return;

    const map1 = L.map(leftRef.current).setView(state.center, state.zoom);
    const map2 = L.map(rightRef.current).setView(state.center, state.zoom);

    map1Ref.current = map1;
    map2Ref.current = map2;

    map1.sync(map2);
    map2.sync(map1);

    map1.on("moveend", handleMoveEnd);

    setTimeout(() => {
      map1.invalidateSize();
      map2.invalidateSize();
    }, 200);

    return () => {
      map1.off("moveend", handleMoveEnd);
      map1.unsync(map2);
      map2.unsync(map1);
      map1.remove();
      map2.remove();
      map1Ref.current = null;
      map2Ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync view from external state
  useEffect(() => {
    if (!map1Ref.current) return;
    isExternalUpdate.current = true;
    map1Ref.current.setView(state.center, state.zoom);
    const timer = setTimeout(() => {
      isExternalUpdate.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [state.center, state.zoom]);

  // Update basemap on left map
  useEffect(() => {
    const map = map1Ref.current;
    if (!map) return;
    if (baseTile1Ref.current) baseTile1Ref.current.remove();
    const tile = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    }).addTo(map);
    baseTile1Ref.current = tile;
    return () => {
      tile.remove();
    };
  }, [basemap]);

  // Update basemap + historical on right map
  useEffect(() => {
    const map = map2Ref.current;
    if (!map) return;
    if (baseTile2Ref.current) baseTile2Ref.current.remove();
    if (histTileRef.current) histTileRef.current.remove();

    const base = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
    }).addTo(map);

    const hist = createHistoricalLayer(historical);
    hist.addTo(map);

    baseTile2Ref.current = base;
    histTileRef.current = hist;

    return () => {
      hist.remove();
      base.remove();
    };
  }, [basemap, historical]);

  useEffect(() => {
    const map1 = map1Ref.current;
    const map2 = map2Ref.current;
    if (!map1 || !map2) return;

    heritage1Ref.current?.remove();
    heritage2Ref.current?.remove();
    heritage1Ref.current = addHeritageLayerToMap(
      map1,
      heritageData,
      onSelectFeature
    );
    heritage2Ref.current = addHeritageLayerToMap(
      map2,
      heritageData,
      onSelectFeature
    );

    return () => {
      heritage1Ref.current?.remove();
      heritage2Ref.current?.remove();
      heritage1Ref.current = null;
      heritage2Ref.current = null;
    };
  }, [heritageData, onSelectFeature]);

  return (
    <div className="side-by-side-shell grid h-full w-full grid-cols-2 gap-0.5 bg-gray-300">
      <div className="comparison-label comparison-label-left">Modern</div>
      <div className="comparison-label comparison-label-right">Historic</div>
      <div ref={leftRef} className="h-full w-full" />
      <div ref={rightRef} className="h-full w-full" />
    </div>
  );
}
