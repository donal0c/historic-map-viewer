import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  heritageCategoryLabels,
  heritageSourceById,
  heritageSources,
} from "../../config/heritageSources";
import {
  buildEvidenceCsv,
  buildEvidenceGeoJson,
  buildEvidenceRecords,
  DEFAULT_EVIDENCE_FILTERS,
  evidenceGroupLabel,
  recordIdentifier,
  type EvidenceFilterState,
  type EvidenceRecord,
} from "../../lib/evidenceBrowser";
import { formatCentre } from "../../lib/viewLabel";
import type {
  HeritageCategoryId,
  HeritageData,
  HeritageFeature,
  HeritageGeometryKind,
  HeritageLayerId,
} from "../../types";

interface EvidenceBrowserProps {
  open: boolean;
  data: HeritageData;
  center: [number, number];
  placeLabel?: string;
  enabledSourceIds: HeritageLayerId[];
  selectedFeature: HeritageFeature | null;
  onClose: () => void;
  onSelectFeature: (feature: HeritageFeature) => void;
}

export default function EvidenceBrowser({
  open,
  data,
  center,
  placeLabel,
  enabledSourceIds,
  selectedFeature,
  onClose,
  onSelectFeature,
}: EvidenceBrowserProps) {
  const [filters, setFilters] = useState<EvidenceFilterState>(
    DEFAULT_EVIDENCE_FILTERS,
  );
  const [exportStatus, setExportStatus] = useState("");
  const browserRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const enabled = useMemo(
    () => new Set<HeritageLayerId>(enabledSourceIds),
    [enabledSourceIds],
  );
  const records = useMemo(
    () => buildEvidenceRecords(data.features, center, filters),
    [center, data.features, filters],
  );
  const groups = useMemo(() => groupRecords(records, filters.group), [
    filters.group,
    records,
  ]);
  const failedSourceIds = enabledSourceIds.filter(
    (id) => data.sources[id]?.status === "error",
  );
  const disabledSourceIds = heritageSources
    .filter((source) => !enabled.has(source.id))
    .map((source) => source.id);
  const readySourceCount = enabledSourceIds.filter(
    (id) => data.sources[id]?.status === "ready",
  ).length;
  const pendingSourceCount = enabledSourceIds.filter((id) =>
    ["idle", "loading"].includes(data.sources[id]?.status ?? "idle"),
  ).length;
  const hasActiveFilters =
    filters.query !== "" ||
    filters.sourceId !== "all" ||
    filters.categoryId !== "all" ||
    filters.geometry !== "all" ||
    filters.maxDistanceMeters !== "all";

  useEffect(() => {
    if (!open) return;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...(browserRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (
        event.shiftKey &&
        document.activeElement === headingRef.current
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const updateFilter = <Key extends keyof EvidenceFilterState>(
    key: Key,
    value: EvidenceFilterState[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));

  const exportContext = () => ({
    center,
    radiusMeters: data.radiusMeters,
    placeLabel,
    exportedAt: new Date().toISOString(),
    filters,
    failedSourceIds,
    disabledSourceIds,
  });

  const download = (format: "geojson" | "csv") => {
    const context = exportContext();
    const content =
      format === "geojson"
        ? JSON.stringify(buildEvidenceGeoJson(records, context), null, 2)
        : buildEvidenceCsv(records, context);
    const filename = `historic-map-evidence-${safeFilename(placeLabel ?? "current-view")}.${format}`;
    downloadText(
      filename,
      content,
      format === "geojson" ? "application/geo+json" : "text/csv",
    );
    setExportStatus(
      `${records.length} filtered ${records.length === 1 ? "record" : "records"} exported as ${format.toUpperCase()}.`,
    );
  };

  return (
    <aside
      ref={browserRef}
      className="evidence-browser"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-browser-title"
    >
      <header className="evidence-browser-header">
        <div>
          <p className="eyebrow">Public evidence register</p>
          <h2 id="evidence-browser-title" ref={headingRef} tabIndex={-1}>
            Evidence in this view
          </h2>
          <p>
            {placeLabel ?? formatCentre(center)}
            <span aria-hidden="true"> · </span>
            {(data.radiusMeters / 1000).toFixed(1)} km radius
          </p>
        </div>
        <button
          type="button"
          className="evidence-browser-close"
          onClick={onClose}
          aria-label="Close evidence register"
        >
          ×
        </button>
      </header>

      <div className="evidence-browser-toolbar">
        <div className="evidence-browser-count" role="status" aria-live="polite">
          <strong>{records.length}</strong>
          <span>
            of {data.features.length} loaded{" "}
            {data.features.length === 1 ? "record" : "records"}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_EVIDENCE_FILTERS)}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="evidence-export">
          <span>Export filtered</span>
          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => download("geojson")}
          >
            GeoJSON
          </button>
          <button
            type="button"
            disabled={records.length === 0}
            onClick={() => download("csv")}
          >
            CSV
          </button>
        </div>
      </div>

      <div className="evidence-filter-grid" aria-label="Filter evidence">
        <label className="evidence-query">
          <span>Find in records</span>
          <input
            type="search"
            value={filters.query}
            placeholder="Name, identifier, source…"
            onChange={(event) => updateFilter("query", event.target.value)}
          />
        </label>
        <EvidenceSelect
          label="Source"
          value={filters.sourceId}
          onChange={(event) =>
            updateFilter(
              "sourceId",
              event.target.value as HeritageLayerId | "all",
            )
          }
        >
          <option value="all">All loaded sources</option>
          {heritageSources
            .filter(
              (source) =>
                enabled.has(source.id) ||
                data.features.some((feature) => feature.layer === source.id),
            )
            .map((source) => (
              <option key={source.id} value={source.id}>
                {source.shortName}
              </option>
            ))}
        </EvidenceSelect>
        <EvidenceSelect
          label="Evidence type"
          value={filters.categoryId}
          onChange={(event) =>
            updateFilter(
              "categoryId",
              event.target.value as HeritageCategoryId | "all",
            )
          }
        >
          <option value="all">All evidence types</option>
          {Object.entries(heritageCategoryLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </EvidenceSelect>
        <EvidenceSelect
          label="Geometry"
          value={filters.geometry}
          onChange={(event) =>
            updateFilter(
              "geometry",
              event.target.value as HeritageGeometryKind | "all",
            )
          }
        >
          <option value="all">Points, routes & areas</option>
          <option value="point">Points</option>
          <option value="line">Routes</option>
          <option value="polygon">Areas</option>
        </EvidenceSelect>
        <EvidenceSelect
          label="Distance"
          value={String(filters.maxDistanceMeters)}
          onChange={(event) =>
            updateFilter(
              "maxDistanceMeters",
              event.target.value === "all"
                ? "all"
                : Number(event.target.value),
            )
          }
        >
          <option value="all">Full query radius</option>
          {[1000, 3000, 7000]
            .filter((distance) => distance < data.radiusMeters)
            .map((distance) => (
              <option key={distance} value={distance}>
                Within {distance / 1000} km
              </option>
            ))}
        </EvidenceSelect>
        <EvidenceSelect
          label="Group"
          value={filters.group}
          onChange={(event) =>
            updateFilter(
              "group",
              event.target.value as EvidenceFilterState["group"],
            )
          }
        >
          <option value="source">Source</option>
          <option value="category">Evidence type</option>
          <option value="geometry">Geometry</option>
        </EvidenceSelect>
        <EvidenceSelect
          label="Sort within groups"
          value={filters.sort}
          onChange={(event) =>
            updateFilter(
              "sort",
              event.target.value as EvidenceFilterState["sort"],
            )
          }
        >
          <option value="distance">Nearest first</option>
          <option value="source">Source name</option>
          <option value="title">Record title</option>
        </EvidenceSelect>
      </div>

      <details className="evidence-source-health">
        <summary>
          <span>Source ledger</span>
          <strong>{readySourceCount} ready</strong>
          {pendingSourceCount > 0 && <em>{pendingSourceCount} pending</em>}
          {failedSourceIds.length > 0 && (
            <em className="source-failed">
              {failedSourceIds.length} unavailable
            </em>
          )}
          <small>{disabledSourceIds.length} off</small>
        </summary>
        <div>
          {heritageSources.map((source) => {
            const result = data.sources[source.id];
            const isEnabled = enabled.has(source.id);
            return (
              <p key={source.id}>
                <i
                  style={
                    { "--source-color": source.color } as React.CSSProperties
                  }
                />
                <span>
                  <strong>{source.shortName}</strong>
                  <small>{source.provider}</small>
                </span>
                <em data-status={isEnabled ? (result?.status ?? "idle") : "off"}>
                  {!isEnabled
                    ? "Off"
                    : result?.status === "error"
                      ? "Unavailable"
                      : result?.status === "loading"
                        ? "Loading"
                        : result?.status === "ready"
                          ? result.truncated
                            ? `First ${result.count}`
                            : `${result.count} loaded`
                          : "Outside zoom"}
                </em>
              </p>
            );
          })}
        </div>
      </details>

      <div className="evidence-results">
        {records.length === 0 ? (
          <div className="evidence-empty">
            <span aria-hidden="true">⌕</span>
            <strong>No records match these filters</strong>
            <p>
              Clear a filter, widen the distance, or enable another public
              evidence layer.
            </p>
          </div>
        ) : (
          groups.map(([label, groupedRecords]) => (
            <section key={label} className="evidence-group">
              <header>
                <h3>{label}</h3>
                <span>{groupedRecords.length}</span>
              </header>
              {groupedRecords.map((record) => (
                <EvidenceRow
                  key={record.feature.id}
                  record={record}
                  selected={selectedFeature?.id === record.feature.id}
                  onSelect={() => onSelectFeature(record.feature)}
                />
              ))}
            </section>
          ))
        )}
      </div>

      <footer className="evidence-browser-footer">
        <p>
          <strong>View-radius snapshot.</strong> Records come from live public
          services and may be incomplete, delayed, or unavailable. This is not
          a national extract or a statutory assessment.
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          {exportStatus}
        </span>
      </footer>
    </aside>
  );
}

function EvidenceSelect({
  label,
  children,
  ...props
}: {
  label: string;
  children: React.ReactNode;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

function EvidenceRow({
  record,
  selected,
  onSelect,
}: {
  record: EvidenceRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const { feature, distanceMeters } = record;
  const source = heritageSourceById[feature.layer];
  const approximate = source.geometry !== "point";
  return (
    <article
      className={`evidence-record${selected ? " selected" : ""}`}
      style={{ "--source-color": source.color } as React.CSSProperties}
    >
      <button type="button" onClick={onSelect}>
        <span className="evidence-record-source">
          <i aria-hidden="true" />
          {source.shortName}
          <em>{recordIdentifier(feature)}</em>
        </span>
        <strong>{feature.title}</strong>
        {feature.subtitle && <p>{feature.subtitle}</p>}
        <small>
          {distanceMeters === undefined
            ? "Distance unavailable"
            : `${approximate ? "Approx. " : ""}${formatDistance(distanceMeters)}`}
          <span aria-hidden="true"> · </span>
          {source.geometry}
          <span aria-hidden="true"> · </span>
          {source.provider}
        </small>
      </button>
      {feature.sourceUrl ? (
        <a
          href={feature.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open original source record for ${feature.title}`}
        >
          Original ↗
        </a>
      ) : (
        <span className="evidence-no-link">No direct link</span>
      )}
    </article>
  );
}

function groupRecords(
  records: EvidenceRecord[],
  group: EvidenceFilterState["group"],
): Array<[string, EvidenceRecord[]]> {
  const grouped = new Map<string, EvidenceRecord[]>();
  for (const record of records) {
    const label = evidenceGroupLabel(record, group);
    const existing = grouped.get(label);
    if (existing) existing.push(record);
    else grouped.set(label, [record]);
  }
  return [...grouped.entries()];
}

function formatDistance(distance: number): string {
  return distance < 1000
    ? `${Math.round(distance)} m`
    : `${(distance / 1000).toFixed(1)} km`;
}

function safeFilename(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
