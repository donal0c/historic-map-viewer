import { historicalLayers } from "../../config/layers";

interface TimelineRailProps {
  value: string;
  onChange: (layerId: string) => void;
}

const ERA_LABELS: Record<string, string> = {
  "6inch-1st": "1829-1842",
  "6inch-2nd": "1888-1913",
  "ireland-1inch-1st": "Early OS",
  "ireland-1inch-2nd": "Contours",
  gsgs4136: "1941-43",
  bartholomew: "1940",
};

export default function TimelineRail({ value, onChange }: TimelineRailProps) {
  return (
    <section className="timeline-rail" aria-label="Historic map timeline">
      <div className="timeline-track" />
      {historicalLayers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          className={value === layer.id ? "active" : ""}
          onClick={() => onChange(layer.id)}
          title={layer.description}
        >
          <span>{ERA_LABELS[layer.id] ?? layer.name}</span>
        </button>
      ))}
    </section>
  );
}
