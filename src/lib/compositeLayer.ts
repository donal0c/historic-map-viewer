import L from "leaflet";
import type { NlsEdition } from "../data/nlsCountyBounds";
import { NLS_TILE_SIZE, nlsTileCandidates } from "./nlsResolver";

const TILE_TIMEOUT_MS = 5000;
const RESULT_CACHE_LIMIT = 2400;

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

function tileKey(edition: NlsEdition, coords: L.Coords): string {
  return `${edition}/${coords.z}/${coords.x}/${coords.y}`;
}

function getCachedSeries(key: string): string[] | undefined {
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
  resultCache.set(key, {
    series,
    expiresAt: Date.now() + (available ? 30 * 60_000 : 5 * 60_000),
  });
  while (resultCache.size > RESULT_CACHE_LIMIT) {
    const oldest = resultCache.keys().next().value;
    if (!oldest) break;
    resultCache.delete(oldest);
  }
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

    for (const candidate of candidates) {
      const image = document.createElement("img");
      image.alt = "";
      image.setAttribute("role", "presentation");
      image.decoding = "async";
      image.crossOrigin = "anonymous";
      image.addEventListener(
        "load",
        async () => {
          await removeBlackNodata(image);
          loadedSeries.push(candidate.series);
          finishedCount += 1;
          if (finishedCount === candidates.length) finish();
        },
        { once: true },
      );
      image.addEventListener(
        "error",
        () => {
          image.remove();
          finishedCount += 1;
          if (finishedCount === candidates.length) finish();
        },
        { once: true },
      );
      images.push(image);
      tile.append(image);
      image.src = candidate.url;
    }

    return tile;
  };

  return layer;
}

function fireOutcome(layer: L.GridLayer, outcome: NlsTileOutcome) {
  layer.fire("nlstileoutcome", outcome);
}

export function clearNlsTileResultCache() {
  resultCache.clear();
}

async function removeBlackNodata(image: HTMLImageElement): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = NLS_TILE_SIZE;
  canvas.height = NLS_TILE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  try {
    context.drawImage(image, 0, 0, NLS_TILE_SIZE, NLS_TILE_SIZE);
    const pixels = context.getImageData(0, 0, NLS_TILE_SIZE, NLS_TILE_SIZE);
    clearBlackNodataPixels(pixels.data);
    context.putImageData(pixels, 0, 0);
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const processedImage = document.createElement("img");
    processedImage.alt = "";
    processedImage.setAttribute("role", "presentation");
    processedImage.decoding = "async";
    processedImage.addEventListener(
      "load",
      () => URL.revokeObjectURL(objectUrl),
      { once: true },
    );
    processedImage.src = objectUrl;
    image.replaceWith(processedImage);
  } catch {
    // If a provider ever drops CORS support, retain the source image so the
    // readiness layer can still report an upstream rendering regression.
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function clearBlackNodataPixels(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    if (
      pixels[index] === 0 &&
      pixels[index + 1] === 0 &&
      pixels[index + 2] === 0
    ) {
      pixels[index + 3] = 0;
    }
  }
}
