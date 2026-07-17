#!/usr/bin/env node

const NMS =
  "https://services-eu1.arcgis.com/HyjXgkV6KGMSF3jt/arcgis/rest/services";
const HERITAGE_MAPS =
  "https://services-eu1.arcgis.com/v5dOXTEOb7ZHdNyQ/arcgis/rest/services";
const service = (base, name, layer = 0) =>
  `${base}/${name}/FeatureServer/${layer}`;

const sources = {
  smr: service(NMS, "SMROpenData"),
  zones: service(NMS, "SMRZoneOpenData"),
  "urban-zones": service(HERITAGE_MAPS, "Zone_of_Archaeological_Potential"),
  niah: service(NMS, "NIAHBuildingsOpenData"),
  "niah-footprints": service(HERITAGE_MAPS, "NIAH_Building_Footprints"),
  excavations: service(HERITAGE_MAPS, "Excavationsie"),
  "holy-wells": service(NMS, "National_Monuments_Service_Holy_Wells"),
  "stone-circles": service(NMS, "National_Monuments_Service_Stone_Circles"),
  "rock-art": service(
    NMS,
    "National_Monuments_Services_Prehistoric_Rock_Art",
  ),
  sweathouses: service(NMS, "NMS_OpenData_sweathouses"),
  "historic-graves": service(HERITAGE_MAPS, "Historic_Graves"),
  wrecks:
    "https://services3.arcgis.com/ArIWe98F0BECP9pn/arcgis/rest/services/Wrecks/FeatureServer/3",
  defence: service(HERITAGE_MAPS, "Defence_Heritage"),
  "martello-towers": service(HERITAGE_MAPS, "Martello_Towers"),
  "ww2-lookouts": service(HERITAGE_MAPS, "WW2_Lookout_Posts"),
  "eire-signs": service(HERITAGE_MAPS, "WW2_%C3%89ire_Signs"),
  workhouses: service(HERITAGE_MAPS, "Workhouses"),
  "disused-railways": service(HERITAGE_MAPS, "Disused_Railways"),
  canals: service(HERITAGE_MAPS, "Canals"),
  waterways: service(HERITAGE_MAPS, "Navigable_Waterways"),
  "historic-towns": service(HERITAGE_MAPS, "Irish_Historic_Towns_Atlas"),
  "parks-gardens": service(HERITAGE_MAPS, "Historic_Parks_and_Gardens"),
  "conservation-areas":
    "https://services-eu1.arcgis.com/SEIHigRppeVyVssQ/arcgis/rest/services/Architectural_Conservation_Areas/FeatureServer/0",
  "dublin-medieval": service(HERITAGE_MAPS, "Dublin_Medieval_Core"),
  "monuments-to-visit": service(NMS, "NMSMonumentsToVisit"),
  "community-monuments": service(NMS, "CommunityMonumentsFund_2020_2024"),
  "norman-settlements": service(
    NMS,
    "Norman_Settlements_for_StoryMap_WFL1",
  ),
};

const timeoutMs = Number(process.env.PROBE_TIMEOUT_MS ?? 12_000);
const concurrency = Number(process.env.PROBE_CONCURRENCY ?? 6);

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json();
    if (!response.ok || body.error) {
      throw new Error(body.error?.message ?? `HTTP ${response.status}`);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function probe([id, url]) {
  const started = performance.now();
  try {
    const metadata = await fetchJson(`${url}?f=json`);
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      resultRecordCount: "1",
      outSR: "4326",
      f: "geojson",
    });
    const sample = await fetchJson(`${url}/query?${params}`);
    return {
      id,
      ok: true,
      geometryType: metadata.geometryType ?? null,
      maxRecordCount: metadata.maxRecordCount ?? null,
      fieldCount: metadata.fields?.length ?? 0,
      sampleCount: sample.features?.length ?? 0,
      cors: true,
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  } catch (error) {
    return {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Math.round(performance.now() - started),
      url,
    };
  }
}

const queue = Object.entries(sources);
const results = [];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (next) results.push(await probe(next));
    }
  }),
);

results.sort((left, right) => left.id.localeCompare(right.id));
const failures = results.filter((result) => !result.ok);
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      summary: {
        sources: results.length,
        healthy: results.length - failures.length,
        failed: failures.length,
      },
      results,
    },
    null,
    2,
  ),
);
process.exitCode = failures.length ? 1 : 0;
