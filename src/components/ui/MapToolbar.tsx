import { useEffect, useRef } from "react";
import type { BlendMode, HeritageData, MapState, ViewMode } from "../../types";
import { basemapLayers } from "../../config/layers";
import { viewModes } from "../../config/modes";

interface MapToolbarProps {
  state: MapState;
  heritageData: HeritageData;
  onModeChange: (mode: ViewMode) => void;
  onBasemapChange: (id: string) => void;
  onBlendModeChange: (mode: BlendMode) => void;
}

export default function MapToolbar({
  state,
  heritageData,
  onModeChange,
  onBasemapChange,
  onBlendModeChange,
}: MapToolbarProps) {
  const moreMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    // The compact "More" menu is a <details>; close it when the user taps
    // anywhere else so it never sits open over the map.
    const closeOnOutsidePress = (event: PointerEvent) => {
      const menu = moreMenuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  const activeSources = Object.values(heritageData.sources).filter(
    (source) => source?.status === "ready",
  ).length;
  const hasTruncatedSource = Object.values(heritageData.sources).some(
    (source) => source?.truncated,
  );
  const modeLabels: Record<ViewMode, string> = {
    overlay: "Overlay",
    swipe: "Swipe",
    "side-by-side": "Side",
    spyglass: "Lens",
  };
  const basemapLabels: Record<string, string> = {
    osm: "OSM",
    light: "Light",
    dark: "Dark",
    satellite: "Sat",
  };
  const renderModeButton = (mode: (typeof viewModes)[number]) => (
    <button
      key={mode.id}
      type="button"
      className={state.mode === mode.id ? "active" : ""}
      onClick={() => {
        onModeChange(mode.id);
        if (moreMenuRef.current) moreMenuRef.current.open = false;
      }}
      title={mode.description}
    >
      <span>{modeLabels[mode.id]}</span>
    </button>
  );

  return (
    <section className="map-toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Compare</span>
        <div className="segmented compare-segmented compare-desktop">
          {viewModes.map(renderModeButton)}
        </div>
        <div className="compare-mobile">
          <div className="segmented compare-primary">
            {viewModes.slice(0, 2).map(renderModeButton)}
          </div>
          <details className="compare-more" ref={moreMenuRef}>
            <summary className={state.mode === "side-by-side" || state.mode === "spyglass" ? "active" : ""}>
              <span>
                {state.mode === "side-by-side"
                  ? "Side"
                  : state.mode === "spyglass"
                    ? "Lens"
                    : "More"}
              </span>
            </summary>
            <div className="segmented">
              {viewModes.slice(2).map(renderModeButton)}
            </div>
          </details>
        </div>
      </div>

      <div className="toolbar-group compact">
        <span className="toolbar-label">Basemap</span>
        <div className="segmented basemap-segmented">
          {basemapLayers.map((layer) => (
            <button
              key={layer.id}
              type="button"
              className={state.basemapId === layer.id ? "active" : ""}
              onClick={() => onBasemapChange(layer.id)}
              title={layer.name}
            >
              {basemapLabels[layer.id] ?? layer.name}
            </button>
          ))}
        </div>
      </div>

      {(state.mode === "overlay" || state.mode === "spyglass") && (
        <div className="toolbar-group blend">
          <span className="toolbar-label">Blend</span>
          <select
            aria-label="Historical map blend mode"
            value={state.blendMode}
            onChange={(event) => onBlendModeChange(event.target.value as BlendMode)}
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="soft-light">Soft light</option>
          </select>
        </div>
      )}

      <div className="toolbar-stats">
        <span>
          {heritageData.features.length}
          {hasTruncatedSource ? "+" : ""} records
        </span>
        <span>{activeSources} live sources</span>
        {heritageData.error && <span className="degraded">Partial data</span>}
      </div>
    </section>
  );
}
