import { useCallback, useState } from "react";
import { useMapState } from "./hooks/useMapState";
import { useHashSync } from "./hooks/useHashSync";
import { useHeritageData } from "./hooks/useHeritageData";
import MapShell from "./components/MapShell";
import OpacitySlider from "./components/controls/OpacitySlider";
import SearchPanel from "./components/ui/SearchPanel";
import TimelineRail from "./components/ui/TimelineRail";
import MapToolbar from "./components/ui/MapToolbar";
import PlaceDossier from "./components/ui/PlaceDossier";
import MapLegend from "./components/ui/MapLegend";
import type { HeritageFeature, SearchResult } from "./types";

export default function App() {
  const {
    state,
    setActiveLayer,
    setBasemap,
    setOpacity,
    setMode,
    setBlendMode,
    setViewPosition,
    setState,
  } = useMapState();
  const heritageData = useHeritageData(state.center, state.zoom);
  const [selectedFeature, setSelectedFeature] = useState<HeritageFeature | null>(
    null
  );

  useHashSync(state, setState);

  const showOpacity = state.mode === "overlay" || state.mode === "spyglass";

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      setViewPosition([result.lat, result.lng], 14);
      setSelectedFeature(null);
    },
    [setViewPosition]
  );

  return (
    <div className="app-shell">
      <MapShell
        state={state}
        heritageData={heritageData}
        onViewChange={setViewPosition}
        onSelectFeature={setSelectedFeature}
      />

      <div className="top-left-stack">
        <SearchPanel
          onSelect={handleSearchSelect}
          onSearchStart={() => setSelectedFeature(null)}
        />
        <MapToolbar
          state={state}
          heritageData={heritageData}
          onModeChange={setMode}
          onBasemapChange={setBasemap}
          onBlendModeChange={setBlendMode}
        />
      </div>

      <PlaceDossier
        state={state}
        data={heritageData}
        selectedFeature={selectedFeature}
        onSelectFeature={setSelectedFeature}
        onCloseFeature={() => setSelectedFeature(null)}
      />

      <TimelineRail value={state.activeLayerId} onChange={setActiveLayer} />

      <MapLegend />

      {showOpacity && (
        <OpacitySlider value={state.opacity} onChange={setOpacity} />
      )}
    </div>
  );
}
