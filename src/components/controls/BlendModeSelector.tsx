import type { BlendMode } from "../../types";
import { blendModes } from "../../config/modes";

interface BlendModeSelectorProps {
  value: BlendMode;
  onChange: (mode: BlendMode) => void;
}

export default function BlendModeSelector({
  value,
  onChange,
}: BlendModeSelectorProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        Blend Mode
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as BlendMode)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {blendModes.map((bm) => (
          <option key={bm.id} value={bm.id}>
            {bm.label}
          </option>
        ))}
      </select>
    </div>
  );
}
