import L from "leaflet";
import type { NlsEdition } from "../data/nlsCountyBounds";
import { NLS_TILE_SIZE, nlsTileCandidates } from "./nlsResolver";
import {
  cacheNodataTile,
  getCachedNodataTile,
  processNodataImage,
} from "./nodataProcessor";
export { clearBlackNodataPixels } from "./nodataPixels";

const TILE_TIMEOUT_MS = 5000;
const RESULT_CACHE_LIMIT = 2400;
const RESULT_CACHE_STORAGE_KEY = "historic-map-viewer:nls-results:v1";
const AVAILABLE_CACHE_TTL_MS = 30 * 60_000;
const EMPTY_CACHE_TTL_MS = 5 * 60_000;

export type NlsTileOutcomeKind = "available" | "empty" | "error";

export interface NlsTileOutcome {
  coords: L.Coords;
  kind: NlsTileOutcomeKind;
  loadedCount: number;
  requestedCount: number;
}

interface CachedResult {
  expiresAt: number;
  series: string[];
}

const resultCache = new Map<string, CachedResult>();
const tileAbortControllers = new WeakMap<HTMLElement, AbortController>();
let resultCacheHydrated = false;
let persistTimer: number | undefined;

function tileKey(edition: NlsEdition, coords: L.Coords): string {
  return `${edition}/${coords.z}/${coords.x}/${coords.y}`;
}

function getCachedSeries(key: string): string[] | undefined {
  hydrateResultCache();
  const cached = resultCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return undefined;
  }
  resultCache.delete(key);
  resultCache.set(key, cached);
  return cached.series;
}

function setCachedSeries(key: string, series: string[], available: boolean) {
  hydrateResultCache();
  resultCache.set(key, {
    series,
    expiresAt:
      Date.now() +
      (available ? AVAILABLE_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS),
  });
  while (resultCache.size > RESULT_CACHE_LIMIT) {
    const oldest = resultCache.keys().next().value;
    if (!oldest) break;
    resultCache.delete(oldest);
  }
  scheduleResultCachePersistence();
}

export function createCompositeCountyLayer(
  edition: NlsEdition,
  options?: L.GridLayerOptions,
): L.GridLayer {
  const layer = new L.GridLayer({
    minZoom: 10,
    maxZoom: 17,
    tileSize: NLS_TILE_SIZE,
    attribution: 'Courtesy of <a href="https://maps.nls.uk/">NLS</a>',
    updateWhenIdle: true,
    keepBuffer: 1,
    ...options,
  });
  layer.on("tileunload", (event: L.TileEvent) => {
    tileAbortControllers.get(event.tile)?.abort();
    tileAbortControllers.delete(event.tile);
  });

  (
    layer as L.GridLayer & {
      createTile(
        coords: L.Coords,
        done: L.DoneCallback,
      ): HTMLElement;
    }
  ).createTile = (
    coords: L.Coords,
    done: L.DoneCallback,
  ): HTMLElement => {
    const tile = document.createElement("div");
    tile.className = "nls-composite-tile";
    tile.setAttribute("role", "presentation");
    const controller = new AbortController();
    tileAbortControllers.set(tile, controller);

    const key = tileKey(edition, coords);
    const cachedSeries = getCachedSeries(key);
    const candidates = cachedSeries
      ? nlsTileCandidates(edition, coords).filter((candidate) =>
          cachedSeries.includes(candidate.series),
        )
      : nlsTileCandidates(edition, coords);

    if (candidates.length === 0) {
      queueMicrotask(() => {
        fireOutcome(layer, {
          coords,
          kind: "empty",
          loadedCount: 0,
          requestedCount: 0,
        });
        done(undefined, tile);
      });
      return tile;
    }

    let settled = false;
    let finishedCount = 0;
    const loadedSeries: string[] = [];
    const images: HTMLImageElement[] = [];

    const finish = (timedOut = false) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (timedOut) controller.abort();
      const available = loadedSeries.length > 0;
      setCachedSeries(key, loadedSeries, available);
      fireOutcome(layer, {
        coords,
        kind: available ? "available" : timedOut ? "error" : "empty",
        loadedCount: loadedSeries.length,
        requestedCount: candidates.length,
      });
      done(undefined, tile);
    };

    const timeout = window.setTimeout(() => {
      for (const image of images) {
        if (!image.complete) image.src = "";
      }
      finish(true);
    }, TILE_TIMEOUT_MS);

    const settleCandidate = (series: string, available: boolean) => {
      if (settled) return;
      if (available) loadedSeries.push(series);
      finishedCount += 1;
      if (finishedCount === candidates.length) finish();
    };

    for (const candidate of candidates) {
      const image = document.createElement("img");
      image.alt = "";
      image.setAttribute("role", "presentation");
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      images.push(image);
      tile.append(image);
      void loadCandidate(
        image,
        candidate.url,
        controller.signal,
      ).then(
        () => settleCandidate(candidate.series, true),
        () => {
          image.remove();
          settleCandidate(candidate.series, false);
        },
      );
    }

    return tile;
  };

  return layer;
}

function fireOutcome(layer: L.GridLayer, outcome: NlsTileOutcome) {
  layer.fire("nlstileoutcome", outcome);
}

export function clearNlsTileResultCache() {
  if (persistTimer !== undefined) window.clearTimeout(persistTimer);
  persistTimer = undefined;
  resultCache.clear();
  resultCacheHydrated = true;
  try {
    localStorage.removeItem(RESULT_CACHE_STORAGE_KEY);
  } catch {
    // Storage is optional.
  }
}

async function loadCandidate(
  image: HTMLImageElement,
  sourceUrl: string,
  signal: AbortSignal,
): Promise<void> {
  const cached = await getCachedNodataTile(sourceUrl);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (cached) {
    await showBlob(image, cached, signal);
    return;
  }

  await loadImage(image, sourceUrl, signal);
  try {
    const blob = await processNodataImage(image, NLS_TILE_SIZE, signal);
    if (!blob) return;
    void cacheNodataTile(sourceUrl, blob);
    await showBlob(image, blob, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    // If a provider ever drops CORS support or a browser cannot process the
    // pixels, retain the source image. Readiness still reports it as loaded.
  }
}

function loadImage(
  image: HTMLImageElement,
  sourceUrl: string,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Historical map image unavailable"));
    };
    const handleAbort = () => {
      cleanup();
      if (!image.complete) image.src = "";
      reject(new DOMException("Aborted", "AbortError"));
    };
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = sourceUrl;
  });
}

function showBlob(
  image: HTMLImageElement,
  blob: Blob,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      signal.removeEventListener("abort", handleAbort);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Processed historical map image unavailable"));
    };
    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    signal.addEventListener("abort", handleAbort, { once: true });
    image.src = objectUrl;
  });
}

function hydrateResultCache() {
  if (resultCacheHydrated) return;
  resultCacheHydrated = true;
  try {
    const serialized = localStorage.getItem(RESULT_CACHE_STORAGE_KEY);
    if (!serialized) return;
    const entries = JSON.parse(serialized) as Array<[string, CachedResult]>;
    const now = Date.now();
    for (const [key, value] of entries) {
      if (
        value.expiresAt > now &&
        Array.isArray(value.series) &&
        resultCache.size < RESULT_CACHE_LIMIT
      ) {
        resultCache.set(key, value);
      }
    }
  } catch {
    try {
      localStorage.removeItem(RESULT_CACHE_STORAGE_KEY);
    } catch {
      // Storage is optional.
    }
  }
}

function scheduleResultCachePersistence() {
  if (persistTimer !== undefined) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    try {
      const now = Date.now();
      const entries = [...resultCache.entries()].filter(
        ([, value]) => value.expiresAt > now,
      );
      localStorage.setItem(RESULT_CACHE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Storage is optional and can be unavailable under privacy settings.
    }
  }, 150);
}
