import { useCallback, useMemo, useState } from "react";
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
import LayerCatalogue from "./components/ui/LayerCatalogue";
import { defaultHeritageSourceIds } from "./config/heritageSources";
import { decodeHeritageSourceIds } from "./lib/hash";
import type {
  HeritageFeature,
  HeritageLayerId,
  HistoricalReadiness,
  SearchResult,
} from "./types";

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
  const [enabledHeritageSources, setEnabledHeritageSources] = useState<
    HeritageLayerId[]
  >(() => restoreEnabledSources());
  const stableEnabledSources = useMemo(
    () => [...enabledHeritageSources].sort(),
    [enabledHeritageSources],
  );
  const heritageData = useHeritageData(
    state.center,
    state.zoom,
    stableEnabledSources,
  );
  const [selectedFeature, setSelectedFeature] = useState<HeritageFeature | null>(
    null
  );
  const [historicalReadiness, setHistoricalReadiness] =
    useState<HistoricalReadiness>({
      status: "idle",
      layerId: state.activeLayerId,
      loadedTiles: 0,
      emptyTiles: 0,
      errorTiles: 0,
      requestedImages: 0,
      message: "Preparing historical map…",
    });

  useHashSync(
    state,
    setState,
    stableEnabledSources,
    setEnabledHeritageSources,
  );

  const showOpacity = state.mode === "overlay" || state.mode === "spyglass";

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      setState((current) => ({
        ...current,
        center: [result.lat, result.lng],
        zoom: 14,
        placeLabel: result.label,
      }));
      setSelectedFeature(null);
    },
    [setState]
  );

  const handleHeritageSourcesChange = useCallback(
    (sourceIds: HeritageLayerId[]) => {
      const unique = [...new Set(sourceIds)];
      setEnabledHeritageSources(unique);
      window.localStorage.setItem(
        "historic-map-viewer:heritage-sources",
        JSON.stringify(unique),
      );
    },
    [],
  );

  return (
    <div className={`app-shell${selectedFeature ? " has-selection" : ""}`}>
      <MapShell
        state={state}
        heritageData={heritageData}
        selectedFeature={selectedFeature}
        onViewChange={setViewPosition}
        onSelectFeature={setSelectedFeature}
        onHistoricalStatusChange={setHistoricalReadiness}
      />

      <div className="top-left-stack">
        <SearchPanel
          placeLabel={state.placeLabel}
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
        historicalReadiness={historicalReadiness}
        selectedFeature={selectedFeature}
        onSelectFeature={setSelectedFeature}
        onCloseFeature={() => setSelectedFeature(null)}
        onShare={() => void shareCurrentView()}
      />

      <LayerCatalogue
        enabledSourceIds={stableEnabledSources}
        data={heritageData}
        zoom={state.zoom}
        onChange={handleHeritageSourcesChange}
      />

      <TimelineRail value={state.activeLayerId} onChange={setActiveLayer} />

      <MapLegend
        enabledSourceIds={stableEnabledSources}
        data={heritageData}
      />

      {showOpacity && (
        <OpacitySlider value={state.opacity} onChange={setOpacity} />
      )}
    </div>
  );
}

async function shareCurrentView() {
  const shareData = {
    title: "Historic Map Viewer",
    text: "Explore this Irish place across historical maps and public heritage records.",
    url: window.location.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(shareData.url);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
  }
}

function restoreEnabledSources(): HeritageLayerId[] {
  try {
    const shared = decodeHeritageSourceIds(window.location.hash);
    if (shared) return shared;
    const stored = JSON.parse(
      window.localStorage.getItem("historic-map-viewer:heritage-sources") ??
        "null",
    );
    if (Array.isArray(stored)) return stored as HeritageLayerId[];
  } catch {
    // A malformed preference should never prevent the atlas from opening.
  }
  return [...defaultHeritageSourceIds];
}
