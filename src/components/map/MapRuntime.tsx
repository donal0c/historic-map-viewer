import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import type {
  HeritageData,
  HeritageFeature,
  HistoricalReadiness,
  MapState,
} from "../../types";
import { IRELAND_BOUNDS } from "../../config/map";
import { basemapLayers, findLayer, historicalLayers } from "../../config/layers";
import { createHistoricalLayer } from "../../lib/createHistoricalLayer";
import {
  addHeritageLayerToMap,
} from "../../lib/mapHeritageLayer";
import type { NlsTileOutcome } from "../../lib/compositeLayer";
import { heritageSourceById } from "../../config/heritageSources";

interface MapRuntimeProps {
  state: MapState;
  heritageData: HeritageData;
  selectedFeature: HeritageFeature | null;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
  onHistoricalStatusChange: (readiness: HistoricalReadiness) => void;
}

const PANE_Z_INDEX = {
  basemap: 200,
  historical: 300,
  polygons: 410,
  lines: 420,
  points: 430,
  selection: 440,
  labels: 450,
} as const;

function initialReadiness(layerId: string): HistoricalReadiness {
  return {
    status: "idle",
    layerId,
    loadedTiles: 0,
    emptyTiles: 0,
    errorTiles: 0,
    requestedImages: 0,
    message: "Preparing historical map…",
  };
}

export default function MapRuntime({
  state,
  heritageData,
  selectedFeature,
  onViewChange,
  onSelectFeature,
  onHistoricalStatusChange,
}: MapRuntimeProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const primaryContainerRef = useRef<HTMLDivElement>(null);
  const secondaryContainerRef = useRef<HTMLDivElement>(null);
  const lensRingRef = useRef<HTMLDivElement>(null);
  const primaryMapRef = useRef<L.Map | null>(null);
  const secondaryMapRef = useRef<L.Map | null>(null);
  const primaryBasemapRef = useRef<L.TileLayer | null>(null);
  const secondaryBasemapRef = useRef<L.TileLayer | null>(null);
  const historicalLayerRef = useRef<L.GridLayer | null>(null);
  const secondaryHistoricalRef = useRef<L.GridLayer | null>(null);
  const primaryHeritageRef = useRef<L.LayerGroup | null>(null);
  const secondaryHeritageRef = useRef<L.LayerGroup | null>(null);
  const selectionRef = useRef<L.GeoJSON | null>(null);
  const externalViewUpdateRef = useRef(false);
  const synchronizingMapsRef = useRef(false);
  const [swipePosition, setSwipePosition] = useState(50);

  const basemap = useMemo(
    () => findLayer(state.basemapId, basemapLayers) ?? basemapLayers[0],
    [state.basemapId],
  );
  const historical = useMemo(
    () =>
      findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0],
    [state.activeLayerId],
  );
  const historicalSupported =
    state.zoom >= (historical.minZoom ?? 0) && state.zoom <= historical.maxZoom;

  const publishView = useCallback(() => {
    const map = primaryMapRef.current;
    if (!map || externalViewUpdateRef.current || synchronizingMapsRef.current) {
      return;
    }
    const center = map.getCenter();
    onViewChange([center.lat, center.lng], map.getZoom());
  }, [onViewChange]);

  useEffect(() => {
    const container = primaryContainerRef.current;
    if (!container || primaryMapRef.current) return;

    const map = L.map(container, {
      zoomControl: true,
      minZoom: 6,
      maxZoom: 19,
      maxBounds: L.latLngBounds(IRELAND_BOUNDS).pad(0.32),
    }).setView(state.center, state.zoom);

    createPanes(map);
    map.on("moveend", publishView);
    primaryMapRef.current = map;

    return () => {
      map.off("moveend", publishView);
      map.remove();
      primaryMapRef.current = null;
    };
    // The map is intentionally created once for the lifetime of the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;
    const current = map.getCenter();
    if (
      Math.abs(current.lat - state.center[0]) < 0.00001 &&
      Math.abs(current.lng - state.center[1]) < 0.00001 &&
      map.getZoom() === state.zoom
    ) {
      return;
    }

    externalViewUpdateRef.current = true;
    map.setView(state.center, state.zoom, { animate: false });
    queueMicrotask(() => {
      externalViewUpdateRef.current = false;
    });
  }, [state.center, state.zoom]);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;
    primaryBasemapRef.current?.remove();
    primaryBasemapRef.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
      pane: "basemapPane",
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(map);
  }, [basemap]);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;

    if (!historicalSupported) {
      historicalLayerRef.current?.remove();
      historicalLayerRef.current = null;
      onHistoricalStatusChange({
        ...initialReadiness(historical.id),
        status: "unsupported-zoom",
        message: `Zoom to ${historical.minZoom ?? 0}–${historical.maxZoom} to view this map.`,
      });
      return;
    }

    const previous = historicalLayerRef.current;
    const next = createHistoricalLayer(historical, {
      pane: "historicalPane",
      opacity: 0,
      updateWhenIdle: true,
      keepBuffer: 1,
    });
    historicalLayerRef.current = next;

    let revealed = false;
    const readiness = initialReadiness(historical.id);
    const targetOpacity = historicalOpacity(state);

    const publish = (nextReadiness: HistoricalReadiness) => {
      Object.assign(readiness, nextReadiness);
      onHistoricalStatusChange({ ...readiness });
    };
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      const container = next.getContainer();
      if (container) {
        container.style.transition = "opacity 240ms ease";
      }
      next.setOpacity(targetOpacity);
      window.setTimeout(() => {
        if (previous && previous !== next) previous.remove();
      }, 280);
    };
    const handleLoading = () => {
      publish({
        ...readiness,
        status: "loading",
        message: "Exposing the historical sheet…",
      });
    };
    const handleTileLoad = () => {
      if (historical.composite) return;
      readiness.loadedTiles += 1;
      reveal();
    };
    const handleTileError = () => {
      readiness.errorTiles += 1;
    };
    const handleNlsOutcome: L.LeafletEventHandlerFn = (leafletEvent) => {
      const event = leafletEvent as L.LeafletEvent & NlsTileOutcome;
      readiness.requestedImages += event.requestedCount;
      if (event.loadedCount > 0) {
        readiness.loadedTiles += 1;
        reveal();
      }
      if (event.kind === "empty") readiness.emptyTiles += 1;
      if (event.kind === "error") readiness.errorTiles += 1;
    };
    const handleLoad = () => {
      const hasTiles = readiness.loadedTiles > 0;
      const hasGaps = readiness.emptyTiles > 0 || readiness.errorTiles > 0;
      reveal();
      publish({
        ...readiness,
        status: hasTiles
          ? hasGaps
            ? "partial"
            : "available"
          : readiness.errorTiles > 0
            ? "error"
            : "outside-coverage",
        message: hasTiles
          ? hasGaps
            ? "Historical coverage is partial in this view."
            : "Historical map ready."
          : readiness.errorTiles > 0
            ? "The historical map source is temporarily unavailable."
            : "This historical series has no mapped sheet here.",
      });
    };

    next.on("loading", handleLoading);
    next.on("tileload", handleTileLoad);
    next.on("tileerror", handleTileError);
    next.on("nlstileoutcome", handleNlsOutcome);
    next.on("load", handleLoad);
    next.addTo(map);
    handleLoading();

    return () => {
      next.off("loading", handleLoading);
      next.off("tileload", handleTileLoad);
      next.off("tileerror", handleTileError);
      next.off("nlstileoutcome", handleNlsOutcome);
      next.off("load", handleLoad);
    };
  }, [
    historical,
    historicalSupported,
    onHistoricalStatusChange,
    // Layer construction is independent of presentation-mode changes.
  ]);

  useEffect(() => {
    const layer = historicalLayerRef.current;
    const map = primaryMapRef.current;
    if (!layer || !map) return;
    layer.setOpacity(historicalOpacity(state));
    const pane = map.getPane("historicalPane");
    if (!pane) return;
    pane.style.mixBlendMode =
      state.mode === "overlay" || state.mode === "spyglass"
        ? state.blendMode
        : "normal";
    applyComparisonClip(pane, state.mode, swipePosition);
  }, [state.mode, state.opacity, state.blendMode, swipePosition]);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;
    primaryHeritageRef.current?.remove();
    primaryHeritageRef.current = addHeritageLayerToMap(
      map,
      heritageData,
      onSelectFeature,
    );

  }, [heritageData, onSelectFeature]);

  useEffect(() => {
    const map = primaryMapRef.current;
    selectionRef.current?.remove();
    selectionRef.current = null;
    if (!map || !selectedFeature) return;

    const source = heritageSourceById[selectedFeature.layer];
    const selection = L.geoJSON(
      {
        type: "Feature",
        geometry: selectedFeature.geometry,
        properties: selectedFeature.raw,
      } as GeoJSON.Feature,
      {
        pane: "selectionPane",
        style: {
          color: "#173f35",
          fillColor: source.color,
          fillOpacity: 0.22,
          opacity: 1,
          weight: 4,
        },
        pointToLayer: (_feature, latlng) =>
          L.circleMarker(latlng, {
            pane: "selectionPane",
            radius: 11,
            color: "#173f35",
            fillColor: source.color,
            fillOpacity: 0.42,
            opacity: 1,
            weight: 3,
            className: "selected-evidence-marker",
          }),
      },
    ).addTo(map);
    selectionRef.current = selection;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (selectedFeature.coordinates) {
      map.flyTo(
        selectedFeature.coordinates,
        Math.max(map.getZoom(), 14),
        reducedMotion ? { animate: false } : { duration: 0.65 },
      );
    } else {
      const bounds = selection.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, {
          maxZoom: 16,
          paddingTopLeft: [80, 150],
          paddingBottomRight: [380, 100],
          animate: !reducedMotion,
          duration: reducedMotion ? undefined : 0.65,
        });
      }
    }

    return () => {
      selection.remove();
      if (selectionRef.current === selection) selectionRef.current = null;
    };
  }, [selectedFeature]);

  useEffect(() => {
    if (state.mode !== "side-by-side") {
      secondaryMapRef.current?.remove();
      secondaryMapRef.current = null;
      secondaryBasemapRef.current = null;
      secondaryHistoricalRef.current = null;
      secondaryHeritageRef.current = null;
      window.setTimeout(() => primaryMapRef.current?.invalidateSize(), 0);
      return;
    }

    const container = secondaryContainerRef.current;
    const primary = primaryMapRef.current;
    if (!container || !primary || secondaryMapRef.current) return;

    const secondary = L.map(container, {
      zoomControl: false,
      attributionControl: false,
      minZoom: 6,
      maxZoom: 19,
    }).setView(state.center, state.zoom);
    createPanes(secondary);
    secondaryMapRef.current = secondary;

    const syncPrimary = () => {
      if (synchronizingMapsRef.current) return;
      synchronizingMapsRef.current = true;
      const center = secondary.getCenter();
      primary.setView(center, secondary.getZoom(), { animate: false });
      synchronizingMapsRef.current = false;
      publishView();
    };
    const syncSecondary = () => {
      if (synchronizingMapsRef.current) return;
      synchronizingMapsRef.current = true;
      secondary.setView(primary.getCenter(), primary.getZoom(), {
        animate: false,
      });
      synchronizingMapsRef.current = false;
    };
    secondary.on("move", syncPrimary);
    primary.on("move", syncSecondary);
    window.setTimeout(() => {
      primary.invalidateSize();
      secondary.invalidateSize();
    }, 0);

    return () => {
      secondary.off("move", syncPrimary);
      primary.off("move", syncSecondary);
      secondary.remove();
      secondaryMapRef.current = null;
    };
  }, [state.mode, publishView]);

  useEffect(() => {
    const map = secondaryMapRef.current;
    if (!map || state.mode !== "side-by-side") return;
    secondaryBasemapRef.current?.remove();
    secondaryBasemapRef.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
      pane: "basemapPane",
    }).addTo(map);
  }, [basemap, state.mode]);

  useEffect(() => {
    const map = secondaryMapRef.current;
    if (!map || state.mode !== "side-by-side" || !historicalSupported) return;
    secondaryHistoricalRef.current?.remove();
    secondaryHistoricalRef.current = createHistoricalLayer(historical, {
      pane: "historicalPane",
      opacity: 1,
    }).addTo(map);
  }, [historical, historicalSupported, state.mode]);

  useEffect(() => {
    const map = secondaryMapRef.current;
    secondaryHeritageRef.current?.remove();
    if (!map || state.mode !== "side-by-side") return;
    secondaryHeritageRef.current = addHeritageLayerToMap(
      map,
      heritageData,
      onSelectFeature,
    );
  }, [heritageData, onSelectFeature, state.mode]);

  useEffect(() => {
    const shell = shellRef.current;
    const map = primaryMapRef.current;
    if (!shell || !map) return;

    const moveLens = (clientX: number, clientY: number) => {
      if (state.mode !== "spyglass") return;
      const rect = shell.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const pane = map.getPane("historicalPane");
      if (pane) {
        pane.style.clipPath = `circle(var(--lens-radius) at ${x}px ${y}px)`;
      }
      if (lensRingRef.current) {
        lensRingRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        lensRingRef.current.dataset.visible = "true";
      }
    };
    const handlePointerMove = (event: PointerEvent) =>
      moveLens(event.clientX, event.clientY);
    const handlePointerLeave = () => {
      if (lensRingRef.current) lensRingRef.current.dataset.visible = "false";
    };
    shell.addEventListener("pointermove", handlePointerMove, { passive: true });
    shell.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      shell.removeEventListener("pointermove", handlePointerMove);
      shell.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [state.mode]);

  return (
    <div
      ref={shellRef}
      className={`map-runtime map-runtime-${state.mode}`}
      data-testid="map-runtime"
    >
      <div
        ref={primaryContainerRef}
        className="map-runtime-primary"
        aria-label="Interactive map of Irish historical and heritage records"
      />
      {state.mode === "side-by-side" && (
        <>
          <div className="comparison-label comparison-label-modern">Modern</div>
          <div className="comparison-label comparison-label-historic">
            Historic
          </div>
          <div
            ref={secondaryContainerRef}
            className="map-runtime-secondary"
            aria-label="Synchronized historical map"
          />
        </>
      )}
      {state.mode === "swipe" && (
        <div
          className="swipe-divider"
          style={{ left: `${swipePosition}%` }}
          data-testid="swipe-divider"
        >
          <input
            aria-label="Historical map reveal position"
            type="range"
            min="5"
            max="95"
            value={swipePosition}
            onChange={(event) => setSwipePosition(Number(event.target.value))}
          />
          <span aria-hidden="true">↔</span>
        </div>
      )}
      <div
        ref={lensRingRef}
        className="lens-ring"
        data-visible="false"
        aria-hidden="true"
      />
    </div>
  );
}

function createPanes(map: L.Map) {
  for (const [name, zIndex] of Object.entries(PANE_Z_INDEX)) {
    const paneName = `${name}Pane`;
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = String(zIndex);
  }
}

function historicalOpacity(state: MapState): number {
  if (state.mode === "side-by-side") return 0;
  if (state.mode === "swipe") return 1;
  return state.opacity;
}

function applyComparisonClip(
  pane: HTMLElement,
  mode: MapState["mode"],
  swipePosition: number,
) {
  if (mode === "swipe") {
    pane.style.clipPath = `inset(0 0 0 ${swipePosition}%)`;
    return;
  }
  if (mode === "spyglass") {
    if (!pane.style.clipPath.startsWith("circle")) {
      pane.style.clipPath = "circle(0 at 50% 50%)";
    }
    return;
  }
  pane.style.clipPath = "none";
}
