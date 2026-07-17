import { heritageSourceById } from "../../config/heritageSources";
import type { HeritageData, HeritageLayerId } from "../../types";

interface MapLegendProps {
  enabledSourceIds: HeritageLayerId[];
  data: HeritageData;
}

export default function MapLegend({
  enabledSourceIds,
  data,
}: MapLegendProps) {
  const visible = enabledSourceIds
    .filter((id) => (data.sources[id]?.count ?? 0) > 0)
    .slice(0, 5);
  if (visible.length === 0) return null;

  return (
    <div className="map-legend" aria-label="Visible heritage layers">
      {visible.map((id) => {
        const source = heritageSourceById[id];
        return (
          <span key={id}>
            <i
              className={`legend-symbol ${source.geometry}`}
              style={
                { "--source-color": source.color } as React.CSSProperties
              }
            />
            {source.shortName}
            <small>{data.sources[id]?.count ?? 0}</small>
          </span>
        );
      })}
      <small>Live public records · select to inspect</small>
    </div>
  );
}
