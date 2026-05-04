import type { ViewMode } from "../../types";
import { viewModes } from "../../config/modes";

interface ModeSelectorProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        Compare Mode
      </label>
      <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
        {viewModes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            title={m.description}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              value === m.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="mr-0.5">{m.icon}</span>
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
