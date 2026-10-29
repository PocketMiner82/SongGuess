import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


interface AudioSeekBarProps {
  value: number; // current playback position (circular handle)
  selectionStart: number; // start of selection stripe
  max: number; // in seconds
  endSeconds?: number; // end of selection stripe
  audioPlayTime?: number;
  disabled?: boolean;
  onChange: (start: number) => void; // selection start changed (moving the stripe)
  onSeek: (position: number) => void; // playback position changed (circular handle drag)
  onClick: (position: number) => void; // playback position changed (click on track)
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

export function AudioSeekBar({
  value,
  selectionStart,
  max,
  endSeconds,
  audioPlayTime,
  disabled = false,
  onChange,
  onSeek,
  onClick,
}: AudioSeekBarProps) {
  const clampedMax = max > 0 ? max : 0;
  const clampedValue = clampedMax > 0 ? Math.min(Math.max(value, 0), clampedMax) : 0;
  const clampedSelection = clampedMax > 0 ? Math.min(Math.max(selectionStart, 0), clampedMax) : 0;

  const valuePercent = clampedMax > 0 ? (clampedValue / clampedMax) * 100 : 0;
  const selectionPercent = clampedMax > 0 ? (clampedSelection / clampedMax) * 100 : 0;

  // Stripe length in percent = audioPlayTime / max
  const stripePercent = useMemo(() => {
    if (!audioPlayTime || clampedMax <= 0) {
      return 0;
    }
    return Math.min((audioPlayTime / clampedMax) * 100, 100);
  }, [audioPlayTime, clampedMax]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"none" | "stripe" | "playback">("none");
  const clickStartRef = useRef<{ x: number; y: number } | null>(null);

  const endPercent = useMemo(() => {
    if (!endSeconds || clampedMax <= 0) {
      return undefined;
    }
    const endClamped = Math.min(Math.max(endSeconds, 0), clampedMax);
    return (endClamped / clampedMax) * 100;
  }, [clampedMax, endSeconds]);

  const getValueFromEvent = useCallback((e: MouseEvent): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return x * clampedMax;
  }, [clampedMax]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || dragging === "none") {
      return;
    }
    const val = getValueFromEvent(e);
    if (dragging === "stripe") {
      onChange(val);
    } else {
      onSeek(val);
    }
  }, [disabled, dragging, getValueFromEvent, onChange, onSeek]);

  const onMouseUp = useCallback(() => {
    setDragging("none");
  }, []);

  const onContainerMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled) {
      return;
    }
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, [disabled]);

  const onContainerMouseUp = useCallback((e: ReactMouseEvent) => {
    if (disabled || !clickStartRef.current) {
      return;
    }
    const dx = Math.abs(e.clientX - clickStartRef.current.x);
    const dy = Math.abs(e.clientY - clickStartRef.current.y);
    clickStartRef.current = null;

    if (dx < 3 && dy < 3) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onClick(x * clampedMax);
      }
    }
  }, [disabled, onClick, clampedMax]);

  useEffect(() => {
    if (dragging === "none") {
      return;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  const onStripeMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled) {
      return;
    }
    e.preventDefault();
    setDragging("stripe");
  }, [disabled]);

  const onPlaybackMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled) {
      return;
    }
    e.preventDefault();
    setDragging("playback");
  }, [disabled]);

  const showEndMarker = endSeconds !== undefined && audioPlayTime !== undefined && clampedMax > 0 && endSeconds > 0 && endSeconds <= clampedMax;
  const isDisabled = disabled || clampedMax <= 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-xs text-disabled-text">
        <span>{formatTime(clampedValue)}</span>
        <span>{formatTime(clampedMax)}</span>
      </div>
      <div className="relative h-6" ref={containerRef} onMouseDown={onContainerMouseDown} onMouseUp={onContainerMouseUp}>
        {/* Track background */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-500" />

        {/* Selection stripe - primary colored, length = audioPlayTime, movable */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary cursor-pointer"
          style={{
            left: `${selectionPercent}%`,
            width: `${stripePercent}%`,
          }}
          onMouseDown={onStripeMouseDown}
        />

        {/* Playback handle - secondary colored circle */}
        <div
          className={`absolute w-4 h-4 rounded-full bg-secondary border-2 border-white shadow-sm cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{
            left: `calc(${valuePercent}% - 2px)`,
            top: "50%",
            transform: "translateY(-50%)",
          }}
          onMouseDown={onPlaybackMouseDown}
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
