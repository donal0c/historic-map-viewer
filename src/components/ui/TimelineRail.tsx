import { useEffect, useState } from "react";
import { historicalLayers, layerSupportsZoom } from "../../config/layers";
import {
  TIME_LAPSE_LABELS,
  TIME_LAPSE_LAYER_IDS,
  TIME_LAPSE_SPEEDS,
  type TimeLapseSpeed,
} from "../../lib/timeLapse";
import type { HistoricalReadiness } from "../../types";

interface TimelineRailProps {
  value: string;
  zoom: number;
  enabled: boolean;
  isPlaying: boolean;
  playbackState: "idle" | "playing" | "paused" | "complete";
  speed: TimeLapseSpeed;
  announcement: string;
  preloadReadiness: HistoricalReadiness | null;
  onChange: (layerId: string) => void;
  onPlay: () => void;
  onPause: () => void;
  onStep: (direction: -1 | 1) => void;
  onSpeedChange: (speed: TimeLapseSpeed) => void;
}

const ERA_LABELS: Record<string, string> = {
  "6inch-1st": "1829–1842",
  "6inch-2nd": "1888–1913",
  "ireland-1inch-1st": "1859–1917",
  "ireland-1inch-2nd": "1898–1902",
  gsgs4136: "1940–42",
  bartholomew: "c. 1940",
};

const timelineLayers = TIME_LAPSE_LAYER_IDS.map(
  (layerId) => historicalLayers.find((layer) => layer.id === layerId)!,
);

export default function TimelineRail({
  value,
  zoom,
  enabled,
  isPlaying,
  playbackState,
  speed,
  announcement,
  preloadReadiness,
  onChange,
  onPlay,
  onPause,
  onStep,
  onSpeedChange,
}: TimelineRailProps) {
  const reducedMotion = useReducedMotion();
  const activeLayer = historicalLayers.find((layer) => layer.id === value);
  const actionLabel =
    playbackState === "complete"
      ? "Replay time travel"
      : isPlaying
        ? "Pause time travel"
        : "Play time travel";

  return (
    <div
      className="timeline-console"
      data-playback-state={playbackState}
      data-preload-status={preloadReadiness?.status ?? "idle"}
    >
      <section className="time-lapse-player" aria-label="Time travel controls">
        <button
          className="time-lapse-play"
          type="button"
          disabled={!enabled}
          aria-label={actionLabel}
          aria-pressed={isPlaying}
          onClick={isPlaying ? onPause : onPlay}
        >
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
        </button>

        <div className="time-lapse-edition">
          <span>Time travel</span>
          <strong>{TIME_LAPSE_LABELS[value] ?? activeLayer?.name}</strong>
          <small title={announcement}>
            {!enabled
              ? "Switch to Overlay mode to play"
              : reducedMotion
                ? "Reduced motion · instant transitions"
                : announcement}
          </small>
        </div>

        <div className="time-lapse-actions">
          <button
            type="button"
            aria-label="Previous historical edition"
            onClick={() => onStep(-1)}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label="Next historical edition"
            onClick={() => onStep(1)}
          >
            <span aria-hidden="true">→</span>
          </button>
          <label>
            <span className="sr-only">Time travel speed</span>
            <select
              aria-label="Time travel speed"
              value={speed}
              onChange={(event) =>
                onSpeedChange(event.target.value as TimeLapseSpeed)
              }
            >
              {Object.entries(TIME_LAPSE_SPEEDS).map(([id, option]) => (
                <option key={id} value={id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="timeline-rail" aria-label="Historic map timeline">
        <div className="timeline-track" />
        {timelineLayers.map((layer) => {
          const drawnHere = layerSupportsZoom(layer, zoom);
          const drawnState = drawnHere
            ? "true"
            : zoom > layer.maxZoom
              ? "zoom-out"
              : "zoom-in";
          return (
            <button
              key={layer.id}
              type="button"
              className={value === layer.id ? "active" : ""}
              aria-current={value === layer.id ? "true" : undefined}
              data-drawn={drawnState}
              onClick={() => onChange(layer.id)}
              title={
                drawnHere
                  ? layer.description
                  : `${layer.name} is drawn at zoom ${layer.minZoom ?? 6}–${layer.maxZoom}. Selecting it zooms there.`
              }
            >
              <span>{ERA_LABELS[layer.id] ?? layer.name}</span>
            </button>
          );
        })}
      </section>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);
  return reducedMotion;
}
