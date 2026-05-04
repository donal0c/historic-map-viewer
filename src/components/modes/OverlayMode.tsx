import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageFeature, MapState } from "../../types";
import { historicalLayers, basemapLayers, findLayer } from "../../config/layers";
import { createHistoricalLayer } from "../../lib/createHistoricalLayer";
import HeritageLayerMount from "../map/HeritageLayerMount";

interface OverlayModeProps {
  state: MapState;
  heritageData: HeritageData;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

function MapViewController({
  center,
  zoom,
  onViewChange,
}: {
  center: LatLngTuple;
  zoom: number;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
}) {
  const map = useMap();
  const isExternalUpdate = useRef(false);

  useEffect(() => {
    isExternalUpdate.current = true;
    map.setView(center, zoom);
    const timer = setTimeout(() => {
      isExternalUpdate.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, [map, center, zoom]);

  useEffect(() => {
    const handler = () => {
      if (isExternalUpdate.current) return;
      const c = map.getCenter();
      onViewChange([c.lat, c.lng], map.getZoom());
    };
    map.on("moveend", handler);
    return () => {
      map.off("moveend", handler);
    };
  }, [map, onViewChange]);

  return null;
}

function HistoricalOverlay({
  state,
}: {
  state: MapState;
}) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);
  const historical =
    findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }

    const layer = createHistoricalLayer(historical, {
      opacity: state.opacity,
      pane: "overlayPane",
    });
    layer.addTo(map);
    layerRef.current = layer;

    // Apply blend mode
    const pane = map.getPane("overlayPane");
    if (pane) {
      (pane as HTMLElement).style.mixBlendMode = state.blendMode;
    }

    return () => {
      layer.remove();
    };
  }, [map, historical, state.blendMode]);

  // Update opacity without recreating layer
  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.setOpacity(state.opacity);
    }
  }, [state.opacity]);

  // Update blend mode without recreating layer
  useEffect(() => {
    const pane = map.getPane("overlayPane");
    if (pane) {
      (pane as HTMLElement).style.mixBlendMode = state.blendMode;
    }
  }, [map, state.blendMode]);

  return null;
}

export default function OverlayMode({
  state,
  heritageData,
  onViewChange,
  onSelectFeature,
}: OverlayModeProps) {
  const basemap = findLayer(state.basemapId, basemapLayers) ?? basemapLayers[0];

  return (
    <MapContainer
      center={state.center}
      zoom={state.zoom}
      className="h-full w-full"
      zoomControl={true}
    >
      <MapViewController
        center={state.center}
        zoom={state.zoom}
        onViewChange={onViewChange}
      />
      <TileLayer
        key={basemap.id}
        url={basemap.url}
        attribution={basemap.attribution}
        maxZoom={basemap.maxZoom}
      />
      <HistoricalOverlay state={state} />
      <HeritageLayerMount
        data={heritageData}
        onSelectFeature={onSelectFeature}
      />
    </MapContainer>
  );
}
