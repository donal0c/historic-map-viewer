interface OpacitySliderProps {
  value: number;
  onChange: (opacity: number) => void;
}

export default function OpacitySlider({ value, onChange }: OpacitySliderProps) {
  return (
    <div className="opacity-control">
      <span>Map exposure</span>
      <input
        aria-label="Historical map opacity"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <output>
        {Math.round(value * 100)}%
      </output>
    </div>
  );
}
