import { clearBlackNodataPixels } from "./nodataPixels";

const PROCESSED_TILE_CACHE = "historic-map-viewer-nodata-v1";
const PROCESSED_TILE_TTL_MS = 7 * 24 * 60 * 60_000;
const PROCESSED_TILE_CACHE_LIMIT = 800;
const MAX_WORKERS = 2;

interface PendingJob {
  id: number;
  bitmap: ImageBitmap;
  size: number;
  resolve: (blob: Blob | null) => void;
  signal?: AbortSignal;
  abort?: () => void;
}

interface ActiveJob extends PendingJob {
  slot: WorkerSlot;
}

interface WorkerSlot {
  worker: Worker;
  busy: boolean;
}

interface WorkerResponse {
  id: number;
  blob?: Blob;
  error?: string;
}

let nextJobId = 1;
let cacheWrites = 0;
let workerSlots: WorkerSlot[] | undefined;
const queue: PendingJob[] = [];
const activeJobs = new Map<number, ActiveJob>();

export async function getCachedNodataTile(
  sourceUrl: string,
): Promise<Blob | undefined> {
  if (!("caches" in window)) return undefined;

  try {
    const cache = await caches.open(PROCESSED_TILE_CACHE);
    const response = await cache.match(sourceUrl);
    const cachedAt = Number(response?.headers.get("X-Cached-At"));
    if (
      response &&
      (!Number.isFinite(cachedAt) ||
        cachedAt + PROCESSED_TILE_TTL_MS <= Date.now())
    ) {
      await cache.delete(sourceUrl);
      return undefined;
    }
    return response?.blob();
  } catch {
    return undefined;
  }
}

export async function cacheNodataTile(sourceUrl: string, blob: Blob) {
  if (!("caches" in window)) return;

  try {
    const cache = await caches.open(PROCESSED_TILE_CACHE);
    await cache.put(
      sourceUrl,
      new Response(blob, {
        headers: {
          "Content-Type": "image/png",
          "X-Historic-Map-Viewer-Cache": "nodata-v1",
          "X-Cached-At": String(Date.now()),
        },
      }),
    );
    cacheWrites += 1;
    if (cacheWrites % 25 === 0) await pruneProcessedTileCache(cache);
  } catch {
    // CacheStorage can be unavailable in private browsing or under quota
    // pressure. The current tile remains usable without persistence.
  }
}

async function pruneProcessedTileCache(cache: Cache) {
  const requests = await cache.keys();
  const excess = requests.length - PROCESSED_TILE_CACHE_LIMIT;
  if (excess <= 0) return;
  await Promise.all(
    requests.slice(0, excess).map((request) => cache.delete(request)),
  );
}

export async function processNodataImage(
  image: HTMLImageElement,
  size: number,
  signal?: AbortSignal,
): Promise<Blob | null> {
  throwIfAborted(signal);
  const startedAt = performance.now();

  try {
    if (supportsWorkerProcessing()) {
      const bitmap = await createImageBitmap(image);
      throwIfAborted(signal, bitmap);
      return await enqueueWorkerJob(bitmap, size, signal);
    }
    return await processOnMainThread(image, size);
  } finally {
    recordDuration("historic-map:nodata-processing", startedAt);
  }
}

function supportsWorkerProcessing() {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

function enqueueWorkerJob(
  bitmap: ImageBitmap,
  size: number,
  signal?: AbortSignal,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const job: PendingJob = {
      id: nextJobId++,
      bitmap,
      size,
      resolve,
      signal,
    };
    const abort = () => cancelJob(job);
    job.abort = abort;
    signal?.addEventListener("abort", abort, { once: true });
    queue.push(job);
    drainQueue();
  });
}

function cancelJob(job: PendingJob) {
  const queuedIndex = queue.findIndex((candidate) => candidate.id === job.id);
  if (queuedIndex >= 0) {
    queue.splice(queuedIndex, 1);
    job.bitmap.close();
    finishJob(job, null);
    return;
  }

  const active = activeJobs.get(job.id);
  if (active) {
    // The shared worker may already be inside convertToBlob. Let it finish,
    // then discard the result instead of terminating unrelated queued work.
    active.signal?.removeEventListener("abort", active.abort!);
  }
}

function drainQueue() {
  for (const slot of getWorkerSlots()) {
    if (slot.busy) continue;
    const job = queue.shift();
    if (!job) return;
    if (job.signal?.aborted) {
      job.bitmap.close();
      finishJob(job, null);
      continue;
    }

    slot.busy = true;
    activeJobs.set(job.id, { ...job, slot });
    slot.worker.postMessage(
      { id: job.id, bitmap: job.bitmap, size: job.size },
      [job.bitmap],
    );
  }
}

function getWorkerSlots(): WorkerSlot[] {
  if (workerSlots) return workerSlots;

  const hardwareLimit = Math.max(
    1,
    Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1),
  );
  workerSlots = Array.from({ length: hardwareLimit }, createWorkerSlot);
  return workerSlots;
}

function createWorkerSlot(): WorkerSlot {
  const slot: WorkerSlot = { worker: spawnWorker(), busy: false };
  attachWorkerListeners(slot);
  return slot;
}

function attachWorkerListeners(slot: WorkerSlot) {
  slot.worker.addEventListener(
    "message",
    (event: MessageEvent<WorkerResponse>) => {
    const active = activeJobs.get(event.data.id);
    if (!active) return;
    activeJobs.delete(active.id);
    slot.busy = false;
    finishJob(
      active,
      active.signal?.aborted || event.data.error ? null : event.data.blob ?? null,
    );
    drainQueue();
    },
  );

  slot.worker.addEventListener("error", () => {
    const active = [...activeJobs.values()].find(
      (candidate) => candidate.slot === slot,
    );
    if (active) {
      activeJobs.delete(active.id);
      finishJob(active, null);
    }
    slot.worker.terminate();
    slot.worker = spawnWorker();
    attachWorkerListeners(slot);
    slot.busy = false;
    drainQueue();
  });
}

function spawnWorker() {
  return new Worker(new URL("./nodata.worker.ts", import.meta.url), {
    type: "module",
  });
}

function finishJob(job: PendingJob, blob: Blob | null) {
  if (job.abort) job.signal?.removeEventListener("abort", job.abort);
  job.resolve(blob);
}

async function processOnMainThread(
  image: HTMLImageElement,
  size: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  clearBlackNodataPixels(pixels.data);
  context.putImageData(pixels, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function throwIfAborted(signal?: AbortSignal, bitmap?: ImageBitmap) {
  if (!signal?.aborted) return;
  bitmap?.close();
  throw new DOMException("Aborted", "AbortError");
}

function recordDuration(name: string, start: number) {
  try {
    performance.measure(name, {
      start,
      duration: performance.now() - start,
    });
  } catch {
    // Performance measurements are diagnostic only.
  }
}
