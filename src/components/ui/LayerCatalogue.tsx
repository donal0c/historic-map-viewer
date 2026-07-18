import { useState } from "react";
import {
  heritageCategoryLabels,
  heritagePresets,
  heritageSources,
} from "../../config/heritageSources";
import type {
  HeritageCategoryId,
  HeritageData,
  HeritageLayerId,
} from "../../types";

interface LayerCatalogueProps {
  enabledSourceIds: HeritageLayerId[];
  data: HeritageData;
  zoom: number;
  onChange: (sourceIds: HeritageLayerId[]) => void;
  onBrowseRecords: () => void;
}

export default function LayerCatalogue({
  enabledSourceIds,
  data,
  zoom,
  onChange,
  onBrowseRecords,
}: LayerCatalogueProps) {
  const [open, setOpen] = useState(false);
  const enabled = new Set(enabledSourceIds);
  const groups = Object.entries(heritageCategoryLabels) as Array<
    [HeritageCategoryId, string]
  >;

  const toggle = (sourceId: HeritageLayerId) => {
    onChange(
      enabled.has(sourceId)
        ? enabledSourceIds.filter((id) => id !== sourceId)
        : [...enabledSourceIds, sourceId],
    );
  };

  return (
    <div className={`layer-catalogue-shell ${open ? "open" : ""}`}>
      <button
        className="layer-catalogue-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="heritage-layer-catalogue"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⌘</span>
        <strong>Evidence</strong>
        <em>{enabledSourceIds.length}</em>
      </button>

      {open && (
        <aside
          id="heritage-layer-catalogue"
          className="layer-catalogue"
          aria-label="Heritage evidence layers"
        >
          <header>
            <div>
              <p className="eyebrow">Public evidence</p>
              <h2>Layers</h2>
            </div>
            <button
              type="button"
              className="catalogue-close"
              onClick={() => setOpen(false)}
              aria-label="Close evidence layers"
            >
              ×
            </button>
          </header>

          <div className="catalogue-presets" aria-label="Layer presets">
            {Object.entries(heritagePresets).map(([name, sourceIds]) => (
              <button
                type="button"
                key={name}
                onClick={() => onChange(sourceIds)}
              >
                {name}
              </button>
            ))}
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>

          <button
            type="button"
            className="catalogue-browse-records"
            onClick={() => {
              setOpen(false);
              onBrowseRecords();
            }}
          >
            <span>
              <strong>Browse complete register</strong>
              <small>
                {data.features.length} loaded{" "}
                {data.features.length === 1 ? "record" : "records"}
              </small>
            </span>
            <em aria-hidden="true">→</em>
          </button>

          <div className="catalogue-groups">
            {groups.map(([categoryId, label]) => (
              <section key={categoryId}>
                <h3>{label}</h3>
                {heritageSources
                  .filter((source) => source.category === categoryId)
                  .map((source) => {
                    const result = data.sources[source.id];
                    const belowZoom = zoom < source.minZoom;
                    return (
                      <label key={source.id}>
                        <input
                          type="checkbox"
                          checked={enabled.has(source.id)}
                          onChange={() => toggle(source.id)}
                        />
                        <i style={{ "--source-color": source.color } as React.CSSProperties} />
                        <span>
                          <strong>{source.name}</strong>
                          <small>
                            {belowZoom
                              ? `Visible from zoom ${source.minZoom}`
                              : result?.status === "loading"
                                ? "Loading…"
                                : result?.status === "error"
                                  ? "Source unavailable"
                                  : enabled.has(source.id)
                                    ? result?.truncated
                                      ? `First ${result.count} shown`
                                      : `${result?.count ?? 0} in view`
                                    : source.description}
                          </small>
                        </span>
                      </label>
                    );
                  })}
              </section>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
