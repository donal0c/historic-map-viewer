import { basemapLayers } from "../../config/layers";

interface BasemapSelectorProps {
  value: string;
  onChange: (basemapId: string) => void;
}

export default function BasemapSelector({
  value,
  onChange,
}: BasemapSelectorProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        Basemap
      </label>
      <div className="flex gap-1">
        {basemapLayers.map((bm) => (
          <button
            key={bm.id}
            onClick={() => onChange(bm.id)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              value === bm.id
                ? "bg-emerald-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {bm.name}
          </button>
        ))}
      </div>
    </div>
  );
}
