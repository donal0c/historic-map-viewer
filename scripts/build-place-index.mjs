import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_URL =
  "https://services-eu1.arcgis.com/FH5XCsx8rYXqnjF5/ArcGIS/rest/services/Townlands___OSi_National_Placenames_Gazetteer/FeatureServer/0";
const OUTPUT_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/data/places",
);
const PAGE_SIZE = 2_000;
const FIELDS = [
  "ID",
  "English_Na",
  "Irish_Name",
  "County",
  "Contae",
].join(",");

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-IE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return value
    .toLocaleLowerCase("en-IE")
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, boundary, letter) =>
      `${boundary}${letter.toLocaleUpperCase("en-IE")}`,
    );
}

function compactPlace(feature) {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  if (
    !Array.isArray(coordinates) ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1]) ||
    !properties.ID ||
    !properties.English_Na
  ) {
    return null;
  }

  return [
    String(properties.ID),
    titleCase(String(properties.English_Na).trim()),
    properties.Irish_Name ? titleCase(String(properties.Irish_Name).trim()) : "",
    properties.County ? titleCase(String(properties.County).trim()) : "",
    properties.Contae ? titleCase(String(properties.Contae).trim()) : "",
    Number(coordinates[1].toFixed(5)),
    Number(coordinates[0].toFixed(5)),
  ];
}

function chunkKeys(place) {
  const keys = new Set(
    [place[1], place[2]]
      .map(normalize)
      .filter(Boolean)
      .map((name) => name[0])
      .filter((key) => /^[a-z]$/.test(key)),
  );
  return keys.size ? keys : new Set(["other"]);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "historic-map-viewer-index-builder/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Placename request failed (${response.status}): ${url}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message ?? "ArcGIS returned an error");
  }
  return json;
}

async function fetchCount() {
  const query = new URL(`${SERVICE_URL}/query`);
  query.search = new URLSearchParams({
    where: "1=1",
    returnCountOnly: "true",
    f: "json",
  });
  const result = await fetchJson(query);
  return result.count;
}

async function fetchPage(offset) {
  const query = new URL(`${SERVICE_URL}/query`);
  query.search = new URLSearchParams({
    where: "1=1",
    outFields: FIELDS,
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "ID",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: "geojson",
  });
  const result = await fetchJson(query);
  return result.features ?? [];
}

async function main() {
  const count = await fetchCount();
  const offsets = Array.from(
    { length: Math.ceil(count / PAGE_SIZE) },
    (_, index) => index * PAGE_SIZE,
  );
  const features = [];

  for (let index = 0; index < offsets.length; index += 4) {
    const batch = await Promise.all(offsets.slice(index, index + 4).map(fetchPage));
    features.push(...batch.flat());
    process.stdout.write(
      `\rFetched ${Math.min(features.length, count).toLocaleString("en-IE")} of ${count.toLocaleString("en-IE")} placenames`,
    );
  }
  process.stdout.write("\n");

  const uniquePlaces = new Map();
  for (const feature of features) {
    const place = compactPlace(feature);
    if (place) uniquePlaces.set(place[0], place);
  }

  const chunks = new Map();
  for (const place of uniquePlaces.values()) {
    for (const key of chunkKeys(place)) {
      const chunk = chunks.get(key) ?? [];
      chunk.push(place);
      chunks.set(key, chunk);
    }
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  for (const file of await readdir(OUTPUT_DIRECTORY)) {
    if (file.endsWith(".json")) await rm(path.join(OUTPUT_DIRECTORY, file));
  }

  const collator = new Intl.Collator("en-IE");
  for (const [key, places] of chunks) {
    places.sort((left, right) => collator.compare(left[1], right[1]));
    await writeFile(
      path.join(OUTPUT_DIRECTORY, `${key}.json`),
      JSON.stringify(places),
    );
  }

  const manifest = {
    version: 1,
    recordCount: uniquePlaces.size,
    generatedAt: new Date().toISOString(),
    source: "Tailte Éireann National Placenames Gazetteer",
    sourceUrl:
      "https://www.arcgis.com/home/item.html?id=f055352696d04eaaa2618518342c4ef5",
    licence: "Creative Commons Attribution 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Contains Tailte Éireann data licensed under CC BY 4.0.",
    chunks: Object.fromEntries(
      [...chunks.entries()].map(([key, places]) => [key, places.length]),
    ),
  };
  await writeFile(
    path.join(OUTPUT_DIRECTORY, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(
    `Wrote ${uniquePlaces.size.toLocaleString("en-IE")} places across ${chunks.size} lazy chunks.`,
  );
}

await main();
