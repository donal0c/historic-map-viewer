import type { LatLngTuple } from "leaflet";
import type { HeritageData, HeritageFeature, MapState } from "../types";
import OverlayMode from "./modes/OverlayMode";
import SwipeMode from "./modes/SwipeMode";
import SideBySideMode from "./modes/SideBySideMode";
import SpyglassMode from "./modes/SpyglassMode";

interface MapShellProps {
  state: MapState;
  heritageData: HeritageData;
  onViewChange: (center: LatLngTuple, zoom: number) => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function MapShell({
  state,
  heritageData,
  onViewChange,
  onSelectFeature,
}: MapShellProps) {
  switch (state.mode) {
    case "overlay":
      return (
        <OverlayMode
          state={state}
          heritageData={heritageData}
          onViewChange={onViewChange}
          onSelectFeature={onSelectFeature}
        />
      );
    case "swipe":
      return (
        <SwipeMode
          state={state}
          heritageData={heritageData}
          onViewChange={onViewChange}
          onSelectFeature={onSelectFeature}
        />
      );
    case "side-by-side":
      return (
        <SideBySideMode
          state={state}
          heritageData={heritageData}
          onViewChange={onViewChange}
          onSelectFeature={onSelectFeature}
        />
      );
    case "spyglass":
      return (
        <SpyglassMode
          state={state}
          heritageData={heritageData}
          onViewChange={onViewChange}
          onSelectFeature={onSelectFeature}
        />
      );
  }
}
