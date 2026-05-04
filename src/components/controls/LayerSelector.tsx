import { historicalLayers } from "../../config/layers";

interface LayerSelectorProps {
  value: string;
  onChange: (layerId: string) => void;
}

export default function LayerSelector({ value, onChange }: LayerSelectorProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        Historical Layer
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {historicalLayers.map((layer) => (
          <option key={layer.id} value={layer.id}>
            {layer.name}
          </option>
        ))}
      </select>
    </div>
  );
}
