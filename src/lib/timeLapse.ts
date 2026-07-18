import { historicalLayers } from "../config/layers";
import type { HistoricalReadiness } from "../types";

export type TimeLapseSpeed = "slow" | "normal" | "fast";

export const TIME_LAPSE_SPEEDS: Record<
  TimeLapseSpeed,
  { label: string; durationMs: number }
> = {
  slow: { label: "Slow", durationMs: 5_500 },
  normal: { label: "Normal", durationMs: 3_500 },
  fast: { label: "Fast", durationMs: 2_000 },
};

export const TIME_LAPSE_LAYER_IDS = [
  "6inch-1st",
  "ireland-1inch-1st",
  "6inch-2nd",
  "ireland-1inch-2nd",
  "bartholomew",
  "gsgs4136",
] as const;

export const TIME_LAPSE_LABELS: Record<string, string> = {
  "6inch-1st": "1829–1842",
  "ireland-1inch-1st": "1859–1917 · 1-inch",
  "6inch-2nd": "1888–1913",
  "ireland-1inch-2nd": "1898–1902 · 2nd ed.",
  bartholomew: "c. 1940",
  gsgs4136: "1940–1942 · War Office",
};

export function timeLapseLayer(layerId: string) {
  return historicalLayers.find((layer) => layer.id === layerId);
}

export function nextTimeLapseLayerId(
  currentLayerId: string,
  skippedLayerIds: ReadonlySet<string> = new Set(),
): string | null {
  const currentIndex = TIME_LAPSE_LAYER_IDS.indexOf(
    currentLayerId as (typeof TIME_LAPSE_LAYER_IDS)[number],
  );
  for (
    let index = Math.max(0, currentIndex + 1);
    index < TIME_LAPSE_LAYER_IDS.length;
    index += 1
  ) {
    const candidate = TIME_LAPSE_LAYER_IDS[index];
    if (!skippedLayerIds.has(candidate)) return candidate;
  }
  return null;
}

export function firstTimeLapseLayerId(
  skippedLayerIds: ReadonlySet<string> = new Set(),
): string | null {
  return (
    TIME_LAPSE_LAYER_IDS.find((layerId) => !skippedLayerIds.has(layerId)) ??
    null
  );
}

export function isUsableTimeLapseReadiness(
  readiness: HistoricalReadiness,
): boolean {
  return readiness.status === "available" || readiness.status === "partial";
}

export function isUnavailableTimeLapseReadiness(
  readiness: HistoricalReadiness,
): boolean {
  return (
    readiness.status === "unsupported-zoom" ||
    readiness.status === "outside-coverage" ||
    readiness.status === "error"
  );
}

export function timeLapseSkipMessage(readiness: HistoricalReadiness): string {
  const label = TIME_LAPSE_LABELS[readiness.layerId] ?? readiness.layerId;
  if (readiness.status === "unsupported-zoom") {
    return `Skipped ${label}: this edition is not available at the current scale.`;
  }
  if (readiness.status === "outside-coverage") {
    return `Skipped ${label}: no mapped sheet covers this view.`;
  }
  return `Skipped ${label}: the map source did not respond.`;
}
