import {
  heritageSourceById,
  type HeritageSourceConfig,
} from "../config/heritageSources";
import type {
  HeritageData,
  HeritageFeature,
  HeritageLayerId,
  HeritageSourceResult,
  SearchResult,
} from "../types";

const HERITAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HERITAGE_CACHE_ENTRIES = 96;

interface HeritageCacheEntry {
  features: HeritageFeature[];
  expiresAt: number;
  updatedAt: string;
}

interface GeoJsonFeature {
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties: Record<string, unknown>;
}

interface GeoJsonCollection {
  features?: GeoJsonFeature[];
}

const heritageCache = new Map<string, HeritageCacheEntry>();
const heritageRequests = new Map<string, Promise<HeritageCacheEntry>>();

export function radiusForZoom(zoom: number): number {
  if (zoom >= 16) return 800;
  if (zoom >= 15) return 1200;
  if (zoom >= 13) return 3000;
  if (zoom >= 11) return 7000;
  return 14000;
}

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const params = new URLSearchParams({ q: clean });
  const url = import.meta.env.DEV
    ? `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
        q: `${clean}, Ireland`,
        format: "jsonv2",
        addressdetails: "1",
        limit: "6",
        countrycodes: "ie",
      })}`
    : `/api/search?${params}`;

  const rows = await fetchJsonWithTimeout<
    Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
    }>
  >(url, 7000);

  return rows
    .map((row) => ({
      id: String(row.place_id),
      label: row.display_name.split(",").slice(0, 2).join(","),
      detail: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }))
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng));
}

export async function fetchHeritageData(
  lat: number,
  lng: number,
  zoom: number,
  enabledSourceIds: HeritageLayerId[],
  signal?: AbortSignal,
): Promise<HeritageData> {
  const radiusMeters = radiusForZoom(zoom);
  const visibleSources = enabledSourceIds
    .map((id) => heritageSourceById[id])
    .filter((source) => zoom >= source.minZoom);

  if (visibleSources.length === 0) {
    return {
      features: [],
      status: "ready",
      radiusMeters,
      sources: Object.fromEntries(
        enabledSourceIds.map((id) => [
          id,
          { status: "idle", count: 0 } satisfies HeritageSourceResult,
        ]),
      ),
    };
  }

  const settled = await Promise.allSettled(
    visibleSources.map((source) =>
      fetchSource(source, lat, lng, radiusMeters, signal),
    ),
  );
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const features: HeritageFeature[] = [];
  const sources: HeritageData["sources"] = {};
  let failures = 0;

  settled.forEach((result, index) => {
    const source = visibleSources[index];
    if (!source) return;
    if (result.status === "fulfilled") {
      features.push(...result.value.features);
      sources[source.id] = {
        status: "ready",
        count: result.value.features.length,
        updatedAt: result.value.updatedAt,
      };
      return;
    }

    failures += 1;
    sources[source.id] = {
      status: "error",
      count: 0,
      error: errorMessage(result.reason),
    };
  });

  for (const id of enabledSourceIds) {
    if (!sources[id]) sources[id] = { status: "idle", count: 0 };
  }

  return {
    features: sortFeatures(features, lat, lng),
    status: failures === visibleSources.length ? "error" : "ready",
    error:
      failures > 0
        ? `${failures} of ${visibleSources.length} enabled sources unavailable`
        : undefined,
    updatedAt: new Date().toISOString(),
    radiusMeters,
    sources,
  };
}

async function fetchSource(
  source: HeritageSourceConfig,
  lat: number,
  lng: number,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<HeritageCacheEntry> {
  const cacheKey = heritageCacheKey(source.id, lat, lng, radiusMeters);
  const cached = heritageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const inFlight = heritageRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(radiusMeters),
    units: "esriSRUnit_Meter",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(source.limit),
  });

  const request = fetchJsonWithTimeout<GeoJsonCollection>(
    `${source.endpoint}?${params}`,
    8000,
    signal,
  )
    .then((collection) => {
      const updatedAt = new Date().toISOString();
      const entry: HeritageCacheEntry = {
        features: (collection.features ?? []).map((feature, index) =>
          normalizeFeature(source, feature, index),
        ),
        updatedAt,
        expiresAt: Date.now() + HERITAGE_CACHE_TTL_MS,
      };
      setHeritageCache(cacheKey, entry);
      return entry;
    })
    .finally(() => {
      heritageRequests.delete(cacheKey);
    });

  heritageRequests.set(cacheKey, request);
  return request;
}

export function normalizeFeature(
  source: HeritageSourceConfig,
  feature: GeoJsonFeature,
  index: number,
): HeritageFeature {
  const properties = feature.properties ?? {};
  const title =
    firstValue(properties, source.titleFields) ?? source.shortName;
  const subtitle = collectValues(properties, source.subtitleFields).join(" · ");
  const detail = collectValues(properties, source.detailFields ?? []).join(
    "\n\n",
  );
  const imageUrl = firstUrl(properties, source.imageFields ?? []);
  const sourceUrl = firstUrl(properties, source.linkFields ?? []);
  const stableId =
    firstValue(properties, [
      "OBJECTID",
      "FID",
      "GlobalID",
      "SMRS",
      "REG_NO",
      "Wreck_No",
      "ZONE_ID",
      "Licence_Number",
    ]) ?? String(index);

  return {
    id: `${source.id}-${stableId}`,
    layer: source.id,
    title,
    subtitle,
    detail: detail || undefined,
    imageUrl,
    sourceUrl,
    coordinates: pointCoordinates(feature.geometry),
    raw: properties,
    geometry: feature.geometry,
  };
}

function pointCoordinates(
  geometry: GeoJsonFeature["geometry"],
): [number, number] | undefined {
  if (geometry?.type !== "Point") return undefined;
  const coords = geometry.coordinates;
  if (!Array.isArray(coords)) return undefined;
  const [lng, lat] = coords;
  return typeof lat === "number" && typeof lng === "number"
    ? [lat, lng]
    : undefined;
}

function firstValue(
  properties: Record<string, unknown>,
  fields: string[],
): string | undefined {
  for (const field of fields) {
    const value = stringValue(properties[field]);
    if (value) return value;
  }
  return undefined;
}

function collectValues(
  properties: Record<string, unknown>,
  fields: string[],
): string[] {
  return fields
    .map((field) => stringValue(properties[field]))
    .filter((value): value is string => Boolean(value));
}

function firstUrl(
  properties: Record<string, unknown>,
  fields: string[],
): string | undefined {
  return collectValues(properties, fields).find((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  });
}

function stringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return !text || text.toUpperCase() === "NULL" ? undefined : text;
}

function sortFeatures(
  features: HeritageFeature[],
  lat: number,
  lng: number,
): HeritageFeature[] {
  return [...features].sort(
    (left, right) =>
      featureDistanceSquared(left, lat, lng) -
        featureDistanceSquared(right, lat, lng) ||
      left.title.localeCompare(right.title),
  );
}

function featureDistanceSquared(
  feature: HeritageFeature,
  lat: number,
  lng: number,
): number {
  if (!feature.coordinates) return Number.MAX_SAFE_INTEGER;
  return (
    (feature.coordinates[0] - lat) ** 2 +
    (feature.coordinates[1] - lng) ** 2
  );
}

function heritageCacheKey(
  sourceId: HeritageLayerId,
  lat: number,
  lng: number,
  radiusMeters: number,
): string {
  return `${sourceId}:${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters}`;
}

function setHeritageCache(key: string, entry: HeritageCacheEntry) {
  if (heritageCache.has(key)) heritageCache.delete(key);
  heritageCache.set(key, entry);

  while (heritageCache.size > MAX_HERITAGE_CACHE_ENTRIES) {
    const oldestKey = heritageCache.keys().next().value;
    if (!oldestKey) break;
    heritageCache.delete(oldestKey);
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = (await response.json()) as T & {
      error?: { message?: string };
    };
    if (body.error) throw new Error(body.error.message ?? "ArcGIS query failed");
    return body;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request superseded";
  }
  return error instanceof Error ? error.message : "Source unavailable";
}
