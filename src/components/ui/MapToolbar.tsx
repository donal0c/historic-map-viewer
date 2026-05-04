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
  const counts = {
    smr: heritageData.features.filter((f) => f.layer === "smr").length,
    niah: heritageData.features.filter((f) => f.layer === "niah").length,
    excavations: heritageData.features.filter((f) => f.layer === "excavations").length,
  };
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

  return (
    <section className="map-toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Compare</span>
        <div className="segmented compare-segmented">
          {viewModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={state.mode === mode.id ? "active" : ""}
              onClick={() => onModeChange(mode.id)}
              title={mode.description}
            >
              <span aria-hidden="true">{mode.icon}</span>
              <span>{modeLabels[mode.id]}</span>
            </button>
          ))}
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
        <span>{counts.smr} monuments</span>
        <span>{counts.niah} buildings</span>
        <span>{counts.excavations} digs</span>
      </div>
    </section>
  );
}
