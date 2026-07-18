import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isUnavailableTimeLapseReadiness,
  isUsableTimeLapseReadiness,
  nextTimeLapseLayerId,
  TIME_LAPSE_LAYER_IDS,
  TIME_LAPSE_LABELS,
  TIME_LAPSE_SPEEDS,
  timeLapseSkipMessage,
  type TimeLapseSpeed,
} from "../lib/timeLapse";
import type { HistoricalReadiness } from "../types";

type PlaybackState = "idle" | "playing" | "paused" | "complete";

interface UseTimeLapseOptions {
  activeLayerId: string;
  enabled: boolean;
  onSelectLayer: (layerId: string) => void;
}

export function useTimeLapse({
  activeLayerId,
  enabled,
  onSelectLayer,
}: UseTimeLapseOptions) {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [speed, setSpeedState] = useState<TimeLapseSpeed>("normal");
  const [preloadLayerId, setPreloadLayerId] = useState<string | null>(null);
  const [preloadReadiness, setPreloadReadiness] =
    useState<HistoricalReadiness | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Ready to travel through the available editions.",
  );
  const [skippedLayerIds, setSkippedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const activeLayerRef = useRef(activeLayerId);
  const transitionStartedAtRef = useRef(0);
  const advanceTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    activeLayerRef.current = activeLayerId;
  }, [activeLayerId]);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== undefined) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = undefined;
    }
  }, []);

  const queueNext = useCallback(
    (
      fromLayerId: string,
      skipped = skippedLayerIds,
      contextMessage?: string,
    ) => {
      const nextLayerId = nextTimeLapseLayerId(fromLayerId, skipped);
      if (!nextLayerId) {
        clearAdvanceTimer();
        setPreloadLayerId(null);
        setPreloadReadiness(null);
        setPlaybackState("complete");
        setAnnouncement(
          skipped.size > 0
            ? `Sequence complete — ${skipped.size} ${
                skipped.size === 1 ? "edition was" : "editions were"
              } unavailable at this scale or location.`
            : "Sequence complete. Replay from the earliest edition.",
        );
        return;
      }
      transitionStartedAtRef.current = performance.now();
      setPreloadReadiness(null);
      setPreloadLayerId(nextLayerId);
      const preparing = `Preparing ${
        TIME_LAPSE_LABELS[nextLayerId] ?? "the next edition"
      }…`;
      setAnnouncement(
        contextMessage ? `${contextMessage} ${preparing}` : preparing,
      );
    },
    [clearAdvanceTimer, skippedLayerIds],
  );

  const pause = useCallback(
    (message = "Time travel paused.") => {
      clearAdvanceTimer();
      setPreloadLayerId(null);
      setPreloadReadiness(null);
      setPlaybackState((current) =>
        current === "idle" ? "idle" : "paused",
      );
      setAnnouncement(message);
    },
    [clearAdvanceTimer],
  );

  const play = useCallback(() => {
    if (!enabled) {
      setAnnouncement("Time travel is available in Overlay mode.");
      return;
    }
    clearAdvanceTimer();
    setSkippedLayerIds(new Set());
    if (playbackState === "idle" || playbackState === "complete") {
      setPlaybackState("playing");
      const startsAtEarliest =
        activeLayerRef.current === TIME_LAPSE_LAYER_IDS[0];
      setAnnouncement(
        startsAtEarliest
          ? "Preparing the next available edition…"
          : "Finding the earliest available edition…",
      );
      queueNext(
        startsAtEarliest ? activeLayerRef.current : "__sequence_start__",
        new Set(),
      );
      return;
    }
    setPlaybackState("playing");
    queueNext(activeLayerRef.current, new Set());
  }, [
    clearAdvanceTimer,
    enabled,
    playbackState,
    queueNext,
  ]);

  const setSpeed = useCallback(
    (nextSpeed: TimeLapseSpeed) => {
      setSpeedState(nextSpeed);
      setAnnouncement(
        `${TIME_LAPSE_SPEEDS[nextSpeed].label} pace selected for the next transition.`,
      );
    },
    [],
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      pause("Stepped through the timeline manually.");
      const ids = TIME_LAPSE_LAYER_IDS;
      const currentIndex = ids.indexOf(
        activeLayerRef.current as (typeof ids)[number],
      );
      const nextIndex = Math.min(
        ids.length - 1,
        Math.max(0, currentIndex + direction),
      );
      onSelectLayer(ids[nextIndex]);
    },
    [onSelectLayer, pause],
  );

  const handlePreloadStatusChange = useCallback(
    (readiness: HistoricalReadiness) => {
      if (
        playbackState !== "playing" ||
        readiness.layerId !== preloadLayerId
      ) {
        return;
      }
      setPreloadReadiness(readiness);
      if (isUnavailableTimeLapseReadiness(readiness)) {
        const nextSkipped = new Set(skippedLayerIds);
        nextSkipped.add(readiness.layerId);
        setSkippedLayerIds(nextSkipped);
        const skipMessage = timeLapseSkipMessage(readiness);
        setAnnouncement(skipMessage);
        queueNext(activeLayerRef.current, nextSkipped, skipMessage);
        return;
      }
      if (!isUsableTimeLapseReadiness(readiness)) return;

      clearAdvanceTimer();
      const elapsed = performance.now() - transitionStartedAtRef.current;
      const delay = Math.max(
        0,
        TIME_LAPSE_SPEEDS[speed].durationMs - elapsed,
      );
      advanceTimerRef.current = window.setTimeout(() => {
        onSelectLayer(readiness.layerId);
        setAnnouncement(
          `${TIME_LAPSE_LABELS[readiness.layerId]} — ${
            readiness.status === "partial"
              ? "partial coverage in this view."
              : "map ready."
          }`,
        );
        // The active-layer crossfade retains its predecessor for 280ms.
        // Start the following preload just after that cleanup so no more than
        // two historical GridLayers are alive at once.
        advanceTimerRef.current = window.setTimeout(() => {
          advanceTimerRef.current = undefined;
          queueNext(readiness.layerId);
        }, 320);
      }, delay);
    },
    [
      clearAdvanceTimer,
      onSelectLayer,
      playbackState,
      preloadLayerId,
      queueNext,
      skippedLayerIds,
      speed,
    ],
  );

  useEffect(() => {
    if (enabled || playbackState === "idle") return;
    pause("Time travel paused because the comparison mode changed.");
  }, [enabled, pause, playbackState]);

  useEffect(() => () => clearAdvanceTimer(), [clearAdvanceTimer]);

  return useMemo(
    () => ({
      playbackState,
      isPlaying: playbackState === "playing",
      speed,
      preloadLayerId,
      preloadReadiness,
      announcement,
      play,
      pause,
      setSpeed,
      step,
      onPreloadStatusChange: handlePreloadStatusChange,
    }),
    [
      announcement,
      handlePreloadStatusChange,
      pause,
      play,
      playbackState,
      preloadLayerId,
      preloadReadiness,
      setSpeed,
      speed,
      step,
    ],
  );
}
