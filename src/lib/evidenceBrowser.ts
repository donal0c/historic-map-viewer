import {
  heritageCategoryLabels,
  heritageSourceById,
} from "../config/heritageSources";
import type {
  HeritageCategoryId,
  HeritageFeature,
  HeritageGeometryKind,
  HeritageLayerId,
} from "../types";

export type EvidenceSort = "distance" | "source" | "title";
export type EvidenceGroup = "source" | "category" | "geometry";

export interface EvidenceFilterState {
  query: string;
  sourceId: HeritageLayerId | "all";
  categoryId: HeritageCategoryId | "all";
  geometry: HeritageGeometryKind | "all";
  maxDistanceMeters: number | "all";
  sort: EvidenceSort;
  group: EvidenceGroup;
}

export interface EvidenceRecord {
  feature: HeritageFeature;
  distanceMeters: number | undefined;
  representativeCoordinates: [number, number] | undefined;
}

export interface EvidenceExportContext {
  center: [number, number];
  radiusMeters: number;
  placeLabel?: string;
  exportedAt: string;
  filters: EvidenceFilterState;
  failedSourceIds: HeritageLayerId[];
  disabledSourceIds: HeritageLayerId[];
}

export const DEFAULT_EVIDENCE_FILTERS: EvidenceFilterState = {
  query: "",
  sourceId: "all",
  categoryId: "all",
  geometry: "all",
  maxDistanceMeters: "all",
  sort: "distance",
  group: "source",
};

const IDENTIFIER_FIELDS = [
  "SMRS",
  "REG_NO",
  "Wreck_No",
  "Licence_Number",
  "ZONE_ID",
  "OBJECTID",
  "FID",
  "GlobalID",
] as const;

export function buildEvidenceRecords(
  features: HeritageFeature[],
  center: [number, number],
  filters: EvidenceFilterState,
): EvidenceRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return features
    .map((feature) => {
      const representativeCoordinates =
        featureRepresentativeCoordinates(feature);
      return {
        feature,
        representativeCoordinates,
        distanceMeters: representativeCoordinates
          ? haversineMeters(center, representativeCoordinates)
          : undefined,
      };
    })
    .filter(({ feature, distanceMeters }) => {
      const source = heritageSourceById[feature.layer];
      if (filters.sourceId !== "all" && feature.layer !== filters.sourceId) {
        return false;
      }
      if (
        filters.categoryId !== "all" &&
        source.category !== filters.categoryId
      ) {
        return false;
      }
      if (filters.geometry !== "all" && source.geometry !== filters.geometry) {
        return false;
      }
      if (
        filters.maxDistanceMeters !== "all" &&
        (distanceMeters === undefined ||
          distanceMeters > filters.maxDistanceMeters)
      ) {
        return false;
      }
      if (!query) return true;
      return [
        feature.title,
        feature.subtitle,
        feature.detail,
        source.name,
        source.provider,
        recordIdentifier(feature),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);
    })
    .sort((left, right) => {
      if (filters.sort === "source") {
        return (
          heritageSourceById[left.feature.layer].name.localeCompare(
            heritageSourceById[right.feature.layer].name,
          ) || left.feature.title.localeCompare(right.feature.title)
        );
      }
      if (filters.sort === "title") {
        return left.feature.title.localeCompare(right.feature.title);
      }
      return (
        (left.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (right.distanceMeters ?? Number.MAX_SAFE_INTEGER) ||
        left.feature.title.localeCompare(right.feature.title)
      );
    });
}

export function evidenceGroupLabel(
  record: EvidenceRecord,
  group: EvidenceGroup,
): string {
  const source = heritageSourceById[record.feature.layer];
  if (group === "category") return heritageCategoryLabels[source.category];
  if (group === "geometry") {
    return `${source.geometry[0]?.toUpperCase()}${source.geometry.slice(1)} evidence`;
  }
  return source.name;
}

export function featureRepresentativeCoordinates(
  feature: HeritageFeature,
): [number, number] | undefined {
  if (feature.coordinates) return feature.coordinates;
  const pairs: Array<[number, number]> = [];
  collectCoordinatePairs(feature.geometry.coordinates, pairs);
  if (pairs.length === 0) return undefined;

  const bounds = pairs.reduce(
    (current, [lng, lat]) => ({
      minLat: Math.min(current.minLat, lat),
      maxLat: Math.max(current.maxLat, lat),
      minLng: Math.min(current.minLng, lng),
      maxLng: Math.max(current.maxLng, lng),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
    },
  );
  return [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ];
}

export function recordIdentifier(feature: HeritageFeature): string {
  for (const field of IDENTIFIER_FIELDS) {
    const value = feature.raw[field];
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return feature.id.replace(`${feature.layer}-`, "");
}

export function buildEvidenceGeoJson(
  records: EvidenceRecord[],
  context: EvidenceExportContext,
) {
  return {
    type: "FeatureCollection",
    metadata: exportMetadata(context, records.length),
    features: records.map(({ feature, distanceMeters }) => {
      const source = heritageSourceById[feature.layer];
      return {
        type: "Feature",
        geometry: feature.geometry,
        properties: {
          ...feature.raw,
          atlas_source_id: source.id,
          atlas_source_name: source.name,
          atlas_provider: source.provider,
          atlas_record_id: recordIdentifier(feature),
          atlas_title: feature.title,
          atlas_subtitle: feature.subtitle,
          atlas_source_url: feature.sourceUrl ?? null,
          atlas_distance_m: roundDistance(distanceMeters),
        },
      };
    }),
  };
}

export function buildEvidenceCsv(
  records: EvidenceRecord[],
  context: EvidenceExportContext,
): string {
  const headers = [
    "source_id",
    "source_name",
    "provider",
    "record_id",
    "title",
    "subtitle",
    "distance_m",
    "latitude",
    "longitude",
    "geometry_type",
    "source_url",
    "query_place",
    "query_latitude",
    "query_longitude",
    "query_radius_m",
    "exported_at",
    "snapshot_note",
    "failed_sources",
    "disabled_sources",
  ];
  const note =
    "View-radius snapshot from live public sources; not a complete national extract.";
  const rows = records.map(
    ({ feature, representativeCoordinates, distanceMeters }) => {
      const source = heritageSourceById[feature.layer];
      return [
        source.id,
        source.name,
        source.provider,
        recordIdentifier(feature),
        feature.title,
        feature.subtitle,
        roundDistance(distanceMeters),
        representativeCoordinates?.[0],
        representativeCoordinates?.[1],
        feature.geometry.type,
        feature.sourceUrl,
        context.placeLabel,
        context.center[0],
        context.center[1],
        context.radiusMeters,
        context.exportedAt,
        note,
        sourceNames(context.failedSourceIds),
        sourceNames(context.disabledSourceIds),
      ];
    },
  );
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function exportMetadata(context: EvidenceExportContext, recordCount: number) {
  return {
    title: "Historic Map Viewer evidence snapshot",
    completeness:
      "View-radius snapshot from live public sources; not a complete national extract.",
    recordCount,
    placeLabel: context.placeLabel ?? null,
    query: {
      latitude: context.center[0],
      longitude: context.center[1],
      radiusMeters: context.radiusMeters,
    },
    exportedAt: context.exportedAt,
    filters: context.filters,
    failedSources: sourceNames(context.failedSourceIds),
    disabledSources: sourceNames(context.disabledSourceIds),
  };
}

function sourceNames(ids: HeritageLayerId[]): string {
  return ids.map((id) => heritageSourceById[id].name).join("; ");
}

function roundDistance(distance: number | undefined) {
  return distance === undefined ? null : Math.round(distance);
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function collectCoordinatePairs(
  value: unknown,
  target: Array<[number, number]>,
) {
  if (!Array.isArray(value)) return;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    target.push([value[0], value[1]]);
    return;
  }
  value.forEach((entry) => collectCoordinatePairs(entry, target));
}

function haversineMeters(
  from: [number, number],
  to: [number, number],
): number {
  const toRadians = Math.PI / 180;
  const latitudeDelta = (to[0] - from[0]) * toRadians;
  const longitudeDelta = (to[1] - from[1]) * toRadians;
  const fromLatitude = from[0] * toRadians;
  const toLatitude = to[0] * toRadians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
}
