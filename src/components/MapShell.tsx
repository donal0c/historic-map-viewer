import type { LatLngTuple } from "leaflet";
import type {
  HeritageData,
  HeritageFeature,
  HistoricalReadiness,
  MapState,
} from "../types";
import MapRuntime from "./map/MapRuntime";

interface MapShellProps {
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

export default function MapShell(props: MapShellProps) {
  return <MapRuntime {...props} />;
}
