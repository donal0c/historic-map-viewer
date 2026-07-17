import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type {
  HeritageData,
  HeritageFeature,
  HistoricalReadiness,
  MapState,
} from "../../types";
import { findLayer, historicalLayers } from "../../config/layers";
import { heritageSourceById } from "../../config/heritageSources";

interface PlaceDossierProps {
  state: MapState;
  data: HeritageData;
  selectedFeature: HeritageFeature | null;
  historicalReadiness: HistoricalReadiness;
  onSelectFeature: (feature: HeritageFeature) => void;
  onCloseFeature: () => void;
  onShare: () => void;
}

export default function PlaceDossier({
  state,
  data,
  selectedFeature,
  historicalReadiness,
  onSelectFeature,
  onCloseFeature,
  onShare,
}: PlaceDossierProps) {
  const [sheetState, setSheetState] = useState<SheetState>("half");
  const dragStartY = useRef<number | null>(null);
  const layer = findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];
  const visibleFeatures = data.features.filter((feature) => feature.layer !== "zones");
  const highlights = visibleFeatures.slice(0, 7);
  const hasTruncatedSource = Object.values(data.sources).some(
    (source) => source?.truncated,
  );

  useEffect(() => {
    if (selectedFeature) setSheetState("half");
  }, [selectedFeature?.id]);

  function moveSheet(direction: -1 | 1) {
    setSheetState((current) => {
      const index = SHEET_STATES.indexOf(current);
      return SHEET_STATES[Math.max(0, Math.min(2, index + direction))] ?? "half";
    });
  }

  function handleSheetPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleSheetPointerUp(event: PointerEvent<HTMLDivElement>) {
    const startY = dragStartY.current;
    dragStartY.current = null;
    if (startY === null) return;
    const distance = event.clientY - startY;
    if (Math.abs(distance) < 14) {
      setSheetState((current) => (current === "half" ? "full" : "half"));
      return;
    }
    moveSheet(distance > 0 ? -1 : 1);
  }

  function handleSheetKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSheet(1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSheet(-1);
    }
  }

  return (
    <aside
      className={`place-dossier ${
        selectedFeature ? `has-selection sheet-${sheetState}` : ""
      }`}
      aria-label="Current place and nearby evidence"
    >
      {selectedFeature && (
        <div
          className="sheet-handle"
          role="slider"
          aria-label="Evidence sheet height"
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={SHEET_STATES.indexOf(sheetState)}
          aria-valuetext={sheetState}
          tabIndex={0}
          onPointerDown={handleSheetPointerDown}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={() => {
            dragStartY.current = null;
          }}
          onKeyDown={handleSheetKeyDown}
        >
          <span aria-hidden="true" />
          <strong>{selectedFeature.title}</strong>
        </div>
      )}
      <div className="dossier-header">
        <p className="eyebrow">Current view</p>
        <button type="button" className="share-control" onClick={onShare}>
          Share
        </button>
        <h2>
          {state.placeLabel ??
            `${state.center[0].toFixed(3)}, ${state.center[1].toFixed(3)}`}
        </h2>
        <p>{layer.name}</p>
      </div>

      <div className="dossier-metrics">
        <Metric label="Radius" value={`${(data.radiusMeters / 1000).toFixed(1)} km`} />
        <Metric
          label="Records"
          value={`${visibleFeatures.length}${hasTruncatedSource ? "+" : ""}`}
        />
        <Metric label="Zoom" value={String(state.zoom)} />
      </div>

      <div className="dossier-status" role="status" aria-live="polite">
        <strong>{historicalReadiness.message}</strong>
        <span>
          {data.status === "loading" && "Refreshing heritage layers…"}
          {data.status === "error" && "Enabled public sources are unavailable."}
          {data.status === "ready" &&
            (data.error ?? "Live public heritage layers loaded.")}
        </span>
      </div>

      {selectedFeature ? (
        <FeatureCard feature={selectedFeature} onClose={onCloseFeature} large />
      ) : (
        <div className="feature-empty">
          <strong>Select a marker</strong>
          <span>Select any visible point, route, or area to inspect its public source record.</span>
        </div>
      )}

      <div className="feature-list">
        <div className="feature-list-title">
          <span>Nearby evidence</span>
          <span>{highlights.length}</span>
        </div>
        {highlights.map((feature) => (
          <button
            type="button"
            key={feature.id}
            onClick={() => onSelectFeature(feature)}
            className={selectedFeature?.id === feature.id ? "active" : ""}
          >
            <span>{heritageSourceById[feature.layer].shortName}</span>
            <strong>{feature.title}</strong>
            <em>{feature.subtitle}</em>
          </button>
        ))}
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeatureCard({
  feature,
  onClose,
  large,
}: {
  feature: HeritageFeature;
  onClose: () => void;
  large?: boolean;
}) {
  return (
    <article className={large ? "feature-card large" : "feature-card"}>
      <button type="button" className="feature-close" onClick={onClose} aria-label="Close feature">
        ×
      </button>
      {feature.imageUrl && <img src={feature.imageUrl} alt="" />}
      <span>{heritageSourceById[feature.layer].shortName}</span>
      <h3>{feature.title}</h3>
      <p className="feature-subtitle">{feature.subtitle}</p>
      {feature.detail && <p>{feature.detail}</p>}
      {feature.sourceUrl && (
        <a href={feature.sourceUrl} target="_blank" rel="noreferrer">
          Open source record
        </a>
      )}
      {feature.relatedRecords && feature.relatedRecords.length > 0 && (
        <div className="feature-related">
          <strong>Related public records</strong>
          {feature.relatedRecords.map((record) =>
            record.sourceUrl ? (
              <a
                key={`${record.layer}-${record.sourceUrl}`}
                href={record.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {heritageSourceById[record.layer].shortName}: {record.title}
              </a>
            ) : (
              <span key={`${record.layer}-${record.title}`}>
                {heritageSourceById[record.layer].shortName}: {record.title}
              </span>
            ),
          )}
        </div>
      )}
    </article>
  );
}

type SheetState = "collapsed" | "half" | "full";
const SHEET_STATES: SheetState[] = ["collapsed", "half", "full"];
