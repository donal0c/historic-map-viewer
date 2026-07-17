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
  const layer = findLayer(state.activeLayerId, historicalLayers) ?? historicalLayers[0];
  const visibleFeatures = data.features.filter((feature) => feature.layer !== "zones");
  const highlights = visibleFeatures.slice(0, 7);

  return (
    <aside
      className={`place-dossier ${selectedFeature ? "has-selection" : ""}`}
      aria-label="Current place and nearby evidence"
    >
      <div className="dossier-header">
        <p className="eyebrow">Current view</p>
        <button type="button" className="share-control" onClick={onShare}>
          Share
        </button>
        <h2>{state.center[0].toFixed(3)}, {state.center[1].toFixed(3)}</h2>
        <p>{layer.name}</p>
      </div>

      <div className="dossier-metrics">
        <Metric label="Radius" value={`${(data.radiusMeters / 1000).toFixed(1)} km`} />
        <Metric label="Records" value={String(visibleFeatures.length)} />
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
    </article>
  );
}
