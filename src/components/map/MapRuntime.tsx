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
  type HeritageLayerController,
} from "../../lib/mapHeritageLayer";
import type { NlsTileOutcome } from "../../lib/compositeLayer";
import { heritageSourceById } from "../../config/heritageSources";

interface MapRuntimeProps {
  state: MapState;
  heritageData: HeritageData;
  selectedFeature: HeritageFeature | null;
  interactionDisabled?: boolean;
  preloadHistoricalLayerId?: string | null;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
  onHistoricalStatusChange: (readiness: HistoricalReadiness) => void;
  onHistoricalPreloadStatusChange?: (readiness: HistoricalReadiness) => void;
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
  interactionDisabled = false,
  preloadHistoricalLayerId = null,
  onViewChange,
  onSelectFeature,
  onHistoricalStatusChange,
  onHistoricalPreloadStatusChange,
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
  const preloadedHistoricalRef = useRef<L.GridLayer | null>(null);
  const secondaryHistoricalRef = useRef<L.GridLayer | null>(null);
  const primaryHeritageRef = useRef<HeritageLayerController | null>(null);
  const secondaryHeritageRef = useRef<HeritageLayerController | null>(null);
  const selectionRef = useRef<L.GeoJSON | null>(null);
  const externalViewUpdateRef = useRef(false);
  const synchronizingMapsRef = useRef(false);
  const lensPointRef = useRef<L.Point | null>(null);
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
      // A fast flick should glide, not fling the sheet thousands of pixels.
      inertiaMaxSpeed: 1800,
    }).setView(state.center, state.zoom);

    createPanes(map);
    map.on("moveend", publishView);
    primaryMapRef.current = map;

    return () => {
      primaryHeritageRef.current?.remove();
      primaryHeritageRef.current = null;
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
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (state.viewTransition === "fly" && !prefersReducedMotion) {
      const releaseExternalUpdate = () => {
        externalViewUpdateRef.current = false;
      };
      map.once("moveend", releaseExternalUpdate);
      map.flyTo(state.center, state.zoom, {
        duration: 0.85,
        easeLinearity: 0.24,
      });
      return () => {
        map.off("moveend", releaseExternalUpdate);
        externalViewUpdateRef.current = false;
      };
    }
    map.setView(state.center, state.zoom, { animate: false });
    queueMicrotask(() => {
      externalViewUpdateRef.current = false;
    });
  }, [state.center, state.viewTransition, state.zoom]);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;
    primaryBasemapRef.current?.remove();
    primaryBasemapRef.current = L.tileLayer(basemap.url, {
      attribution: basemap.attribution,
      maxZoom: basemap.maxZoom,
      maxNativeZoom: basemap.maxNativeZoom,
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
      bounds: L.latLngBounds(IRELAND_BOUNDS),
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
    const map = primaryMapRef.current;
    const preloadLayer = preloadHistoricalLayerId
      ? findLayer(preloadHistoricalLayerId, historicalLayers)
      : undefined;

    preloadedHistoricalRef.current?.remove();
    preloadedHistoricalRef.current = null;

    if (
      !map ||
      !preloadLayer ||
      preloadLayer.id === historical.id ||
      state.mode !== "overlay" ||
      !onHistoricalPreloadStatusChange
    ) {
      return;
    }

    const supported =
      state.zoom >= (preloadLayer.minZoom ?? 0) &&
      state.zoom <= preloadLayer.maxZoom;
    if (!supported) {
      onHistoricalPreloadStatusChange({
        ...initialReadiness(preloadLayer.id),
        status: "unsupported-zoom",
        message: `Zoom to ${preloadLayer.minZoom ?? 0}–${preloadLayer.maxZoom} to view this map.`,
      });
      return;
    }

    const next = createHistoricalLayer(preloadLayer, {
      pane: "historicalPane",
      opacity: 0,
      bounds: L.latLngBounds(IRELAND_BOUNDS),
      updateWhenIdle: true,
      keepBuffer: 1,
    });
    preloadedHistoricalRef.current = next;
    const readiness = initialReadiness(preloadLayer.id);

    const publish = (nextReadiness: HistoricalReadiness) => {
      Object.assign(readiness, nextReadiness);
      onHistoricalPreloadStatusChange({ ...readiness });
    };
    const handleLoading = () => {
      publish({
        ...readiness,
        status: "loading",
        message: "Preloading the next historical edition…",
      });
    };
    const handleTileLoad = () => {
      if (!preloadLayer.composite) readiness.loadedTiles += 1;
    };
    const handleTileError = () => {
      readiness.errorTiles += 1;
    };
    const handleNlsOutcome: L.LeafletEventHandlerFn = (leafletEvent) => {
      const event = leafletEvent as L.LeafletEvent & NlsTileOutcome;
      readiness.requestedImages += event.requestedCount;
      if (event.loadedCount > 0) readiness.loadedTiles += 1;
      if (event.kind === "empty") readiness.emptyTiles += 1;
      if (event.kind === "error") readiness.errorTiles += 1;
    };
    const handleLoad = () => {
      const hasTiles = readiness.loadedTiles > 0;
      const hasGaps = readiness.emptyTiles > 0 || readiness.errorTiles > 0;
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
            ? "The next edition has partial coverage in this view."
            : "The next historical edition is ready."
          : readiness.errorTiles > 0
            ? "The next map source is temporarily unavailable."
            : "The next edition has no mapped sheet here.",
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
      next.remove();
      if (preloadedHistoricalRef.current === next) {
        preloadedHistoricalRef.current = null;
      }
    };
  }, [
    historical.id,
    onHistoricalPreloadStatusChange,
    preloadHistoricalLayerId,
    state.mode,
    state.zoom,
  ]);

  const applyComparisonClip = useCallback(() => {
    const map = primaryMapRef.current;
    const pane = map?.getPane("historicalPane");
    if (!map || !pane) return;
    const ring = lensRingRef.current;

    if (state.mode === "swipe") {
      // Clip paths resolve against the pane's own box, which pans with the
      // map, so the reveal edge is expressed in layer coordinates and
      // recomputed whenever the map moves.
      const size = map.getSize();
      const origin = map.containerPointToLayerPoint([0, 0]);
      const left = origin.x + (size.x * swipePosition) / 100;
      const right = origin.x + size.x;
      const top = origin.y;
      const bottom = origin.y + size.y;
      pane.style.clipPath = `polygon(${left}px ${top}px, ${right}px ${top}px, ${right}px ${bottom}px, ${left}px ${bottom}px)`;
      return;
    }

    if (state.mode === "spyglass") {
      const size = map.getSize();
      const point =
        lensPointRef.current ?? L.point(size.x / 2, size.y / 2);
      lensPointRef.current = point;
      const layerPoint = map.containerPointToLayerPoint(point);
      pane.style.clipPath = `circle(var(--lens-radius) at ${layerPoint.x}px ${layerPoint.y}px)`;
      if (ring) {
        ring.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
        ring.dataset.visible = "true";
      }
      return;
    }

    pane.style.clipPath = "none";
    if (ring) ring.dataset.visible = "false";
  }, [state.mode, swipePosition]);

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
    if (state.mode !== "spyglass") lensPointRef.current = null;
    applyComparisonClip();
    map.on("move zoom zoomanim viewreset resize", applyComparisonClip);
    return () => {
      map.off("move zoom zoomanim viewreset resize", applyComparisonClip);
    };
  }, [applyComparisonClip, state.mode, state.opacity, state.blendMode, historical]);

  useEffect(() => {
    const map = primaryMapRef.current;
    if (!map) return;
    if (primaryHeritageRef.current) {
      primaryHeritageRef.current.update(heritageData, onSelectFeature);
    } else {
      primaryHeritageRef.current = addHeritageLayerToMap(
        map,
        heritageData,
        onSelectFeature,
      );
    }
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
      secondaryHeritageRef.current?.remove();
      secondaryHeritageRef.current = null;
      secondaryMapRef.current?.remove();
      secondaryMapRef.current = null;
      secondaryBasemapRef.current = null;
      secondaryHistoricalRef.current = null;
      // The primary container changes width when the comparison layout
      // changes, and nothing else tells Leaflet. Always remeasure after the
      // new layout has been painted so the full viewport gets tiles.
      const resizeTimer = window.setTimeout(() => {
        const primary = primaryMapRef.current;
        if (!primary) return;
        synchronizingMapsRef.current = true;
        primary.invalidateSize({ pan: false });
        synchronizingMapsRef.current = false;
      }, 0);
      return () => window.clearTimeout(resizeTimer);
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
    let readyForUserMovement = false;

    const syncPrimary = () => {
      if (synchronizingMapsRef.current) return;
      synchronizingMapsRef.current = true;
      const center = secondary.getCenter();
      primary.setView(center, secondary.getZoom(), { animate: false });
      synchronizingMapsRef.current = false;
    };
    const publishSecondaryView = () => {
      if (readyForUserMovement) publishView();
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
    secondary.on("moveend", publishSecondaryView);
    primary.on("move", syncSecondary);
    const initializationTimer = window.setTimeout(() => {
      synchronizingMapsRef.current = true;
      primary.invalidateSize({ pan: false });
      secondary.invalidateSize({ pan: false });
      secondary.setView(primary.getCenter(), primary.getZoom(), {
        animate: false,
      });
      synchronizingMapsRef.current = false;
      readyForUserMovement = true;
    }, 0);

    return () => {
      window.clearTimeout(initializationTimer);
      secondaryHeritageRef.current?.remove();
      secondaryHeritageRef.current = null;
      secondary.off("move", syncPrimary);
      secondary.off("moveend", publishSecondaryView);
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
      maxNativeZoom: basemap.maxNativeZoom,
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
      bounds: L.latLngBounds(IRELAND_BOUNDS),
    }).addTo(map);
  }, [historical, historicalSupported, state.mode]);

  useEffect(() => {
    const map = secondaryMapRef.current;
    if (!map || state.mode !== "side-by-side") return;
    if (secondaryHeritageRef.current) {
      secondaryHeritageRef.current.update(heritageData, onSelectFeature);
    } else {
      secondaryHeritageRef.current = addHeritageLayerToMap(
        map,
        heritageData,
        onSelectFeature,
      );
    }
  }, [heritageData, onSelectFeature, state.mode]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || state.mode !== "spyglass") return;

    const handlePointerMove = (event: PointerEvent) => {
      const rect = shell.getBoundingClientRect();
      lensPointRef.current = L.point(
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      applyComparisonClip();
    };
    shell.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      shell.removeEventListener("pointermove", handlePointerMove);
    };
  }, [applyComparisonClip, state.mode]);

  return (
    <div
      ref={shellRef}
      className={`map-runtime map-runtime-${state.mode}${
        state.zoom <= 8 && state.mode === "overlay"
          ? " map-runtime-national-overview"
          : ""
      }`}
      data-testid="map-runtime"
      inert={interactionDisabled}
      aria-hidden={interactionDisabled || undefined}
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
