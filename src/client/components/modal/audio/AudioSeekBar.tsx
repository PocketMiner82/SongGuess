import type { ChangeEvent } from "react";
import { useCallback, useMemo } from "react";


interface AudioSeekBarProps {
  value: number; // in seconds
  max: number; // in seconds
  endSeconds?: number;
  audioPlayTime?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}


function formatTime(seconds: number): string {
  if (Number.isNaN(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}


export function AudioSeekBar({ value, max, endSeconds, audioPlayTime, disabled = false, onChange }: AudioSeekBarProps) {
  const clampedMax = max > 0 ? max : 0;
  const clampedValue = clampedMax > 0 ? Math.min(Math.max(value, 0), clampedMax) : 0;

  const valuePercent = clampedMax > 0 ? (clampedValue / clampedMax) * 100 : 0;

  const endPercent = useMemo(() => {
    if (!endSeconds || clampedMax <= 0) {
      return undefined;
    }
    const endClamped = Math.min(Math.max(endSeconds, 0), clampedMax);
    return (endClamped / clampedMax) * 100;
  }, [clampedMax, endSeconds]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    const newValue = Number(e.target.value);
    onChange(newValue);
  }, [disabled, onChange]);

  const showEndMarker = endSeconds !== undefined && audioPlayTime !== undefined && clampedMax > 0 && endSeconds > 0 && endSeconds <= clampedMax;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-xs text-disabled-text">
        <span>{formatTime(clampedValue)}</span>
        <span>{formatTime(clampedMax)}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={clampedMax}
          step={0.1}
          value={clampedValue}
          disabled={disabled || clampedMax <= 0}
          onChange={handleChange}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, var(--color-secondary) 0%, var(--color-secondary) ${valuePercent}%, var(--color-primary) ${valuePercent}%, var(--color-primary) ${endPercent !== undefined ? endPercent : valuePercent}%, #4b5563 ${endPercent !== undefined ? endPercent : valuePercent}%, #4b5563 100%)`,
          }}
        />
        {showEndMarker && endPercent !== undefined && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-secondary rounded pointer-events-none"
            style={{ left: `${endPercent}%` }}
            title={`End at ${formatTime(endSeconds)}`}
          />
        )}
      </div>
    </div>
  );
}
