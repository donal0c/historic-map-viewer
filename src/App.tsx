import { useCallback, useEffect, useMemo, useState } from "react";
import type { LatLngTuple } from "leaflet";
import { useMapState } from "./hooks/useMapState";
import { useHashSync } from "./hooks/useHashSync";
import { useHeritageData } from "./hooks/useHeritageData";
import { useTimeLapse } from "./hooks/useTimeLapse";
import MapShell from "./components/MapShell";
import OpacitySlider from "./components/controls/OpacitySlider";
import SearchPanel from "./components/ui/SearchPanel";
import TimelineRail from "./components/ui/TimelineRail";
import MapToolbar from "./components/ui/MapToolbar";
import PlaceDossier from "./components/ui/PlaceDossier";
import MapLegend from "./components/ui/MapLegend";
import LayerCatalogue from "./components/ui/LayerCatalogue";
import ExplorePanel from "./components/ui/ExplorePanel";
import StoryPlayer from "./components/ui/StoryPlayer";
import EvidenceBrowser from "./components/ui/EvidenceBrowser";
import { defaultHeritageSourceIds } from "./config/heritageSources";
import { decodeHeritageSourceIds } from "./lib/hash";
import { featureRepresentativeCoordinates } from "./lib/evidenceBrowser";
import {
  atlasDestinations,
  atlasStories,
  readStoryRoute,
  storyUrl,
} from "./data/stories";
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
  const evidenceCenter = useMemo<[number, number]>(
    () => [state.center[0], state.center[1]],
    [state.center[0], state.center[1]],
  );
  const [selectedFeature, setSelectedFeature] = useState<HeritageFeature | null>(
    null
  );
  const [dossierOpen, setDossierOpen] = useState(false);
  const [evidenceBrowserOpen, setEvidenceBrowserOpen] = useState(false);
  const [activeStoryRoute, setActiveStoryRoute] = useState(() =>
    readStoryRoute(window.location.search),
  );
  const [exploreOpen, setExploreOpen] = useState(
    () => window.location.hash.length === 0 && !readStoryRoute(window.location.search),
  );
  const [locateStatus, setLocateStatus] = useState<
    "idle" | "locating" | "denied" | "error"
  >("idle");
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
  const {
    playbackState,
    isPlaying,
    speed: timeLapseSpeed,
    preloadLayerId,
    preloadReadiness,
    announcement: timeLapseAnnouncement,
    play: playTimeLapse,
    pause: pauseTimeLapse,
    setSpeed: setTimeLapseSpeed,
    step: stepTimeLapse,
    onPreloadStatusChange,
  } = useTimeLapse({
    activeLayerId: state.activeLayerId,
    enabled: state.mode === "overlay" && !activeStoryRoute,
    onSelectLayer: setActiveLayer,
  });

  useHashSync(
    state,
    setState,
    stableEnabledSources,
    setEnabledHeritageSources,
  );

  const showOpacity = state.mode === "overlay" || state.mode === "spyglass";

  const applyStoryStep = useCallback(
    (storyId: string, stepIndex: number) => {
      const story = atlasStories.find((candidate) => candidate.id === storyId);
      const step = story?.steps[stepIndex];
      if (!story || !step) return;
      setState((current) => ({
        ...current,
        center: step.center,
        zoom: step.zoom,
        viewTransition: "fly",
        placeLabel: story.place,
        activeLayerId: step.activeLayerId,
        mode: step.mode,
        blendMode: step.blendMode ?? current.blendMode,
        opacity: step.opacity ?? current.opacity,
      }));
      setEnabledHeritageSources(step.enabledSources);
      setSelectedFeature(null);
      setDossierOpen(true);
      setEvidenceBrowserOpen(false);
      setExploreOpen(false);
      pauseTimeLapse("Time travel paused while a guided story is open.");
    },
    [pauseTimeLapse, setState],
  );

  useEffect(() => {
    if (activeStoryRoute) {
      applyStoryStep(
        activeStoryRoute.storyId,
        activeStoryRoute.stepIndex,
      );
    }
    // The initial deep link is applied once; later navigation calls apply directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const route = readStoryRoute(window.location.search);
      setActiveStoryRoute(route);
      if (route) applyStoryStep(route.storyId, route.stepIndex);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [applyStoryStep]);

  const leaveStory = useCallback((historyMode: "push" | "replace" = "push") => {
    setActiveStoryRoute(null);
    setDossierOpen(false);
    window.history[`${historyMode}State`](null, "", storyUrl(null));
  }, []);

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      pauseTimeLapse("Time travel paused because the map moved.");
      setState((current) => ({
        ...current,
        center: [result.lat, result.lng],
        zoom: 14,
        viewTransition: "instant",
        placeLabel: result.label,
      }));
      setSelectedFeature(null);
      setDossierOpen(false);
      setEvidenceBrowserOpen(false);
      setExploreOpen(false);
      leaveStory("replace");
    },
    [leaveStory, pauseTimeLapse, setState]
  );

  const startStory = useCallback(
    (storyId: string) => {
      const route = { storyId, stepIndex: 0 };
      setActiveStoryRoute(route);
      applyStoryStep(route.storyId, route.stepIndex);
      window.history.pushState(null, "", storyUrl(storyId, 0));
    },
    [applyStoryStep],
  );

  const changeStoryStep = useCallback(
    (stepIndex: number) => {
      if (!activeStoryRoute) return;
      const story = atlasStories.find(
        (candidate) => candidate.id === activeStoryRoute.storyId,
      );
      if (!story || stepIndex < 0 || stepIndex >= story.steps.length) return;
      const route = { storyId: story.id, stepIndex };
      setActiveStoryRoute(route);
      applyStoryStep(route.storyId, route.stepIndex);
      window.history.pushState(
        null,
        "",
        storyUrl(route.storyId, route.stepIndex),
      );
    },
    [activeStoryRoute, applyStoryStep],
  );

  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateStatus("error");
      return;
    }
    setLocateStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        handleSearchSelect({
          id: "current-location",
          label: "Near you",
          detail: "Approximate location from this device",
          lat: coords.latitude,
          lng: coords.longitude,
          source: "geolocation",
        });
        setLocateStatus("idle");
      },
      (error) => {
        setLocateStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 300_000 },
    );
  }, [handleSearchSelect]);

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

  const handleSelectFeature = useCallback((feature: HeritageFeature) => {
    setSelectedFeature(feature);
    setDossierOpen(true);
  }, []);

  const handleEvidenceSelect = useCallback(
    (feature: HeritageFeature) => {
      pauseTimeLapse("Time travel paused because the map moved.");
      const coordinates = featureRepresentativeCoordinates(feature);
      setSelectedFeature(feature);
      setDossierOpen(true);
      setEvidenceBrowserOpen(false);
      if (coordinates) {
        setState((current) => ({
          ...current,
          center: coordinates,
          zoom: Math.max(current.zoom, 15),
          viewTransition: "fly",
        }));
      }
    },
    [pauseTimeLapse, setState],
  );

  const openEvidenceBrowser = useCallback(() => {
    pauseTimeLapse("Time travel paused while the evidence browser is open.");
    setExploreOpen(false);
    setDossierOpen(false);
    setEvidenceBrowserOpen(true);
  }, [pauseTimeLapse]);

  const closeEvidenceBrowser = useCallback(() => {
    setEvidenceBrowserOpen(false);
  }, []);

  const openExplore = useCallback(() => {
    pauseTimeLapse("Time travel paused while Explore is open.");
    setSelectedFeature(null);
    setDossierOpen(false);
    setEvidenceBrowserOpen(false);
    setExploreOpen(true);
  }, [pauseTimeLapse]);

  const handleViewChange = useCallback(
    (center: LatLngTuple, zoom: number) => {
      pauseTimeLapse("Time travel paused because you moved the map.");
      setViewPosition(center, zoom);
    },
    [pauseTimeLapse, setViewPosition],
  );

  const handleTimelineChange = useCallback(
    (layerId: string) => {
      pauseTimeLapse("Time travel paused on the selected edition.");
      setActiveLayer(layerId);
    },
    [pauseTimeLapse, setActiveLayer],
  );

  const handleModeChange = useCallback(
    (mode: Parameters<typeof setMode>[0]) => {
      pauseTimeLapse("Time travel paused because the comparison mode changed.");
      setMode(mode);
    },
    [pauseTimeLapse, setMode],
  );

  const handleBasemapChange = useCallback(
    (basemapId: string) => {
      pauseTimeLapse("Time travel paused because the basemap changed.");
      setBasemap(basemapId);
    },
    [pauseTimeLapse, setBasemap],
  );

  return (
    <div className={`app-shell${selectedFeature ? " has-selection" : ""}${activeStoryRoute ? " has-story" : ""}${exploreOpen ? " has-explore" : ""}${dossierOpen ? " dossier-expanded" : ""}${evidenceBrowserOpen ? " has-evidence-browser" : ""}`}>
      <MapShell
        state={state}
        heritageData={heritageData}
        selectedFeature={selectedFeature}
        interactionDisabled={evidenceBrowserOpen}
        preloadHistoricalLayerId={preloadLayerId}
        onViewChange={handleViewChange}
        onSelectFeature={handleSelectFeature}
        onHistoricalStatusChange={setHistoricalReadiness}
        onHistoricalPreloadStatusChange={onPreloadStatusChange}
      />

      <div className="top-left-stack">
        <SearchPanel
          placeLabel={state.placeLabel}
          onSelect={handleSearchSelect}
          onSearchStart={() => {
            setSelectedFeature(null);
            setDossierOpen(false);
            setEvidenceBrowserOpen(false);
          }}
          onExplore={openExplore}
        />
        <MapToolbar
          state={state}
          heritageData={heritageData}
          onModeChange={handleModeChange}
          onBasemapChange={handleBasemapChange}
          onBlendModeChange={setBlendMode}
        />
      </div>

      <ExplorePanel
        open={exploreOpen}
        imagesReady={
          historicalReadiness.status !== "idle" &&
          historicalReadiness.status !== "loading"
        }
        stories={atlasStories}
        destinations={atlasDestinations}
        locateStatus={locateStatus}
        onClose={() => setExploreOpen(false)}
        onSelectDestination={handleSearchSelect}
        onStartStory={startStory}
        onLocate={locateUser}
      />

      {activeStoryRoute && (
        <StoryPlayer
          story={
            atlasStories.find(
              (story) => story.id === activeStoryRoute.storyId,
            ) ?? atlasStories[0]
          }
          stepIndex={activeStoryRoute.stepIndex}
          onStepChange={changeStoryStep}
          onExit={() => leaveStory()}
          onShare={() => void shareCurrentView()}
        />
      )}

      <PlaceDossier
        state={state}
        data={heritageData}
        historicalReadiness={historicalReadiness}
        selectedFeature={selectedFeature}
        expanded={Boolean(selectedFeature || activeStoryRoute || dossierOpen)}
        showShare={!activeStoryRoute}
        onExpand={() => setDossierOpen(true)}
        onCollapse={() => {
          setSelectedFeature(null);
          setDossierOpen(false);
        }}
        onSelectFeature={handleSelectFeature}
        onCloseFeature={() => setSelectedFeature(null)}
        onBrowseEvidence={openEvidenceBrowser}
        onShare={() => void shareCurrentView()}
      />

      <LayerCatalogue
        enabledSourceIds={stableEnabledSources}
        data={heritageData}
        zoom={state.zoom}
        onChange={handleHeritageSourcesChange}
        onBrowseRecords={openEvidenceBrowser}
      />

      <EvidenceBrowser
        open={evidenceBrowserOpen}
        data={heritageData}
        center={evidenceCenter}
        placeLabel={state.placeLabel}
        enabledSourceIds={stableEnabledSources}
        selectedFeature={selectedFeature}
        onClose={closeEvidenceBrowser}
        onSelectFeature={handleEvidenceSelect}
      />

      <TimelineRail
        value={state.activeLayerId}
        enabled={state.mode === "overlay" && !activeStoryRoute}
        isPlaying={isPlaying}
        playbackState={playbackState}
        speed={timeLapseSpeed}
        announcement={timeLapseAnnouncement}
        preloadReadiness={preloadReadiness}
        onChange={handleTimelineChange}
        onPlay={playTimeLapse}
        onPause={() => pauseTimeLapse()}
        onStep={stepTimeLapse}
        onSpeedChange={setTimeLapseSpeed}
      />

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
