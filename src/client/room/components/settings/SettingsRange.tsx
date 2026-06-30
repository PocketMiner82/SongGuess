import type { ReactNode } from "react";


interface SettingsRangeProps {
  value: number;
  onChange: (value: number) => void;
  displayText?: string;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  children?: ReactNode;
}

export function SettingsRange({
  value,
  onChange,
  displayText,
  className,
  disabled = false,
  min = 0,
  max = 1,
  step = 0.01,
  children,
}: SettingsRangeProps) {
  const label = children?.toString() || "range";

  return (
    <div
      className="flex items-center gap-2"
      onWheel={(e) => {
        if (disabled)
          return;

        const direction = e.deltaY > 0 ? -1 : 1;
        const stepped = Math.round((value + direction * step * 2) / (step * 2)) * step * 2;
        onChange(Math.min(max, Math.max(min, +stepped.toFixed(10))));
        (e.target as HTMLElement).blur();
      }}
    >
      {children !== null && (
        <span className={`flex-none whitespace-nowrap ${disabled ? "text-disabled-text" : ""}`}>
          {children}
        </span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number.parseFloat(e.target.value))}
        aria-label={label}
        className={`${className} flex-1 h-1.5 appearance-none cursor-pointer rounded-full bg-gray-500
          accent-secondary
          focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-0
          disabled:opacity-50 disabled:cursor-not-allowed
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:border-0
          [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-secondary [&::-moz-range-thumb]:border-0`}
      />
      {displayText !== null && (
        <span className={`flex-none text-sm min-w-9 text-right tabular-nums ${disabled ? "text-disabled-text" : ""}`}>
          {displayText}
        </span>
      )}
    </div>
  );
}
