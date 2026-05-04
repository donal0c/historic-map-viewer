import type {
  HeritageData,
  HeritageFeature,
  HeritageLayerId,
  SearchResult,
} from "../types";

const NMS_BASE =
  "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services";
const EXCAVATIONS_BASE =
  "https://services-eu1.arcgis.com/v5dOXTEOb7ZHdNyQ/arcgis/rest/services";

const ENDPOINTS: Record<HeritageLayerId, string> = {
  smr: `${NMS_BASE}/SMROpenData/FeatureServer/0/query`,
  zones: `${NMS_BASE}/SMRZoneOpenData/FeatureServer/1/query`,
  niah: `${NMS_BASE}/NIAHBuildingsOpenData/FeatureServer/0/query`,
  excavations: `${EXCAVATIONS_BASE}/Excavationsie/FeatureServer/0/query`,
};

const FIELDS: Record<HeritageLayerId, string> = {
  smr: "SMRS,MONUMENT_CLASS,TOWNLAND,COUNTY,WEBSITE_LINK,WEB_NOTES,FIRST_EDITION,LATEST_EDITION",
  zones: "ZONE_ID",
  niah: "REG_NO,NAME,ORIGINAL_TYPE,IN_USE_AS_TYPE,RATING,DATEFROM,DATETO,DESCRIPTION,APPRAISAL,IMAGE_LINK,WEBSITE_LINK,TOWNLAND,COUNTY",
  excavations:
    "Site_Name,Site_Type,Licence_Number,SMR_Number,County,URL,Author",
};

const LIMITS: Record<HeritageLayerId, number> = {
  smr: 32,
  zones: 12,
  niah: 28,
  excavations: 28,
};
const HERITAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HERITAGE_CACHE_ENTRIES = 24;

interface HeritageCacheEntry {
  data: HeritageData;
  expiresAt: number;
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
const heritageRequests = new Map<string, Promise<HeritageData>>();

export const HERITAGE_LAYER_LABELS: Record<HeritageLayerId, string> = {
  smr: "Archaeology",
  zones: "SMR zones",
  niah: "Architecture",
  excavations: "Excavations",
};

export function radiusForZoom(zoom: number): number {
  if (zoom >= 15) return 1200;
  if (zoom >= 13) return 3000;
  if (zoom >= 11) return 7000;
  return 14000;
}

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const params = new URLSearchParams({
    q: `${clean}, Ireland`,
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "ie",
  });

  const rows = await fetchJsonWithTimeout<
    Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
      class?: string;
    }>
  >(`https://nominatim.openstreetmap.org/search?${params}`, 7000);

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
  zoom: number
): Promise<HeritageData> {
  const radiusMeters = radiusForZoom(zoom);
  const cacheKey = heritageCacheKey(lat, lng, radiusMeters);
  const cached = heritageCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inFlight = heritageRequests.get(cacheKey);
  if (inFlight) return inFlight;

  const layers: HeritageLayerId[] = ["smr", "zones", "niah", "excavations"];
  const request = Promise.allSettled(
    layers.map((layer) => fetchLayer(layer, lat, lng, radiusMeters))
  )
    .then((settled) => {
      const data: HeritageData = {
        features: settled.flatMap((result) =>
          result.status === "fulfilled" ? result.value : []
        ),
        status: "ready",
        updatedAt: new Date().toISOString(),
        radiusMeters,
      };

      setHeritageCache(cacheKey, data);
      return data;
    })
    .finally(() => {
      heritageRequests.delete(cacheKey);
    });

  heritageRequests.set(cacheKey, request);
  return request;
}

async function fetchLayer(
  layer: HeritageLayerId,
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<HeritageFeature[]> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    distance: String(layer === "zones" ? Math.min(radiusMeters, 5000) : radiusMeters),
    units: "esriSRUnit_Meter",
    outFields: FIELDS[layer],
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: String(LIMITS[layer]),
  });

  const collection = await fetchJsonWithTimeout<GeoJsonCollection>(
    `${ENDPOINTS[layer]}?${params}`,
    layer === "zones" ? 9000 : 6500
  );

  return (collection.features ?? []).map((feature, index) =>
    normalizeFeature(layer, feature, index)
  );
}

function normalizeFeature(
  layer: HeritageLayerId,
  feature: GeoJsonFeature,
  index: number
): HeritageFeature {
  const p = feature.properties ?? {};
  const coords = pointCoordinates(feature.geometry);

  if (layer === "smr") {
    return {
      id: `${layer}-${stringValue(p.SMRS) || index}`,
      layer,
      title: stringValue(p.MONUMENT_CLASS) || "Recorded monument",
      subtitle: compact([stringValue(p.SMRS), stringValue(p.TOWNLAND), stringValue(p.COUNTY)]),
      detail: stringValue(p.WEB_NOTES),
      sourceUrl: stringValue(p.WEBSITE_LINK),
      coordinates: coords,
      raw: p,
      geometry: feature.geometry,
    };
  }

  if (layer === "niah") {
    const dates = compact([stringValue(p.DATEFROM), stringValue(p.DATETO)], "-");
    return {
      id: `${layer}-${stringValue(p.REG_NO) || index}`,
      layer,
      title: stringValue(p.NAME) || stringValue(p.ORIGINAL_TYPE) || "NIAH building",
      subtitle: compact([
        stringValue(p.RATING),
        stringValue(p.ORIGINAL_TYPE),
        dates,
        stringValue(p.TOWNLAND),
      ]),
      detail: stringValue(p.DESCRIPTION) || stringValue(p.APPRAISAL),
      imageUrl: stringValue(p.IMAGE_LINK),
      sourceUrl: stringValue(p.WEBSITE_LINK),
      coordinates: coords,
      raw: p,
      geometry: feature.geometry,
    };
  }

  if (layer === "excavations") {
    return {
      id: `${layer}-${stringValue(p.URL) || index}`,
      layer,
      title: stringValue(p.Site_Name) || "Excavation record",
      subtitle: compact([
        stringValue(p.Site_Type),
        stringValue(p.Licence_Number),
        stringValue(p.County),
      ]),
      detail: compact([stringValue(p.Author), stringValue(p.SMR_Number)]),
      sourceUrl: stringValue(p.URL),
      coordinates: coords,
      raw: p,
      geometry: feature.geometry,
    };
  }

  return {
    id: `${layer}-${stringValue(p.ZONE_ID) || index}`,
    layer,
    title: "SMR zone",
    subtitle: stringValue(p.ZONE_ID) || "Archaeological zone",
    detail:
      "Expected location zone around a recorded monument. It is contextual, not a legal screening boundary.",
    raw: p,
    geometry: feature.geometry,
  };
}

function pointCoordinates(geometry: GeoJsonFeature["geometry"]): [number, number] | undefined {
  if (geometry?.type !== "Point") return undefined;
  const coords = geometry.coordinates;
  if (!Array.isArray(coords)) return undefined;
  const [lng, lat] = coords;
  return typeof lat === "number" && typeof lng === "number" ? [lat, lng] : undefined;
}

function stringValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text === "NULL" ? "" : text;
}

function compact(values: string[], joiner = " · "): string {
  return values.filter(Boolean).join(joiner);
}

function heritageCacheKey(lat: number, lng: number, radiusMeters: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)},${radiusMeters}`;
}

function setHeritageCache(key: string, data: HeritageData) {
  if (heritageCache.has(key)) {
    heritageCache.delete(key);
  }

  heritageCache.set(key, {
    data,
    expiresAt: Date.now() + HERITAGE_CACHE_TTL_MS,
  });

  while (heritageCache.size > MAX_HERITAGE_CACHE_ENTRIES) {
    const oldestKey = heritageCache.keys().next().value;
    if (!oldestKey) break;
    heritageCache.delete(oldestKey);
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}
