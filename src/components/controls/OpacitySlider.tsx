interface OpacitySliderProps {
  value: number;
  onChange: (opacity: number) => void;
}

export default function OpacitySlider({ value, onChange }: OpacitySliderProps) {
  return (
    <div className="absolute bottom-6 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/80 px-5 py-2.5 shadow-lg backdrop-blur-md">
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
        Opacity
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-48 accent-emerald-600 cursor-pointer"
      />
      <span className="text-xs font-mono text-gray-500 w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
