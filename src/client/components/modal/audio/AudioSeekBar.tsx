import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


interface AudioSeekBarProps {
  value: number; // current playback position (circular handle)
  selectionStart: number; // start of selection stripe
  max: number; // in seconds
  selectionEnd?: number; // end of selection stripe
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
  selectionEnd,
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
  // Used to ignore mouse compatibility events that fire shortly after touch events on mobile.
  const lastTouchRef = useRef<number>(0);

  const endPercent = useMemo(() => {
    if (!selectionEnd || clampedMax <= 0) {
      return undefined;
    }
    const endClamped = Math.min(Math.max(selectionEnd, 0), clampedMax);
    return (endClamped / clampedMax) * 100;
  }, [clampedMax, selectionEnd]);

  const startPercent = clampedMax > 0 ? (clampedSelection / clampedMax) * 100 : 0;

  const showStartMarker = clampedMax > 0;
  const showEndMarker = selectionEnd !== undefined && clampedMax > 0 && selectionEnd > 0 && selectionEnd <= clampedMax;
  const isDisabled = disabled || clampedMax <= 0;

  const getValueFromPosition = useCallback((clientX: number): number => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return x * clampedMax;
  }, [clampedMax]);

  const getValueFromEvent = useCallback((e: MouseEvent): number => {
    return getValueFromPosition(e.clientX);
  }, [getValueFromPosition]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (disabled || Date.now() - lastTouchRef.current < 500 || dragging === "none") {
      return;
    }
    const val = getValueFromEvent(e);
    if (dragging === "stripe") {
      onChange(val);
    } else {
      onSeek(val);
    }
  }, [disabled, dragging, getValueFromEvent, onChange, onSeek]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || dragging === "none") {
      return;
    }
    e.preventDefault();
    const val = getValueFromPosition(e.touches[0].clientX);
    if (dragging === "stripe") {
      onChange(val);
    } else {
      onSeek(val);
    }
  }, [disabled, dragging, getValueFromPosition, onChange, onSeek]);

  const onMouseUp = useCallback(() => {
    setDragging("none");
  }, []);

  const onTouchEnd = useCallback(() => {
    setDragging("none");
  }, []);

  const onContainerMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled || Date.now() - lastTouchRef.current < 500) {
      return;
    }
    clickStartRef.current = { x: e.clientX, y: e.clientY };
  }, [disabled]);

  const onContainerTouchStart = useCallback((e: ReactTouchEvent) => {
    if (disabled) {
      return;
    }
    lastTouchRef.current = Date.now();
    e.preventDefault();
    clickStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, [disabled]);

  const onContainerMouseUp = useCallback((e: ReactMouseEvent) => {
    if (disabled || Date.now() - lastTouchRef.current < 500 || !clickStartRef.current) {
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

  const onContainerTouchEnd = useCallback((e: ReactTouchEvent) => {
    if (disabled || !clickStartRef.current) {
      return;
    }
    const dx = Math.abs(e.changedTouches[0].clientX - clickStartRef.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - clickStartRef.current.y);
    clickStartRef.current = null;

    if (dx < 3 && dy < 3) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const x = Math.max(0, Math.min(1, (e.changedTouches[0].clientX - rect.left) / rect.width));
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
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [dragging, onMouseMove, onMouseUp, onTouchMove, onTouchEnd]);

  const onStripeMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled || Date.now() - lastTouchRef.current < 500) {
      return;
    }
    e.preventDefault();
    setDragging("stripe");
  }, [disabled]);

  const onStripeTouchStart = useCallback((e: ReactTouchEvent) => {
    if (disabled) {
      return;
    }
    lastTouchRef.current = Date.now();
    e.preventDefault();
    setDragging("stripe");
  }, [disabled]);

  const onPlaybackMouseDown = useCallback((e: ReactMouseEvent) => {
    if (disabled || Date.now() - lastTouchRef.current < 500) {
      return;
    }
    e.preventDefault();
    setDragging("playback");
  }, [disabled]);

  const onPlaybackTouchStart = useCallback((e: ReactTouchEvent) => {
    if (disabled) {
      return;
    }
    lastTouchRef.current = Date.now();
    e.preventDefault();
    setDragging("playback");
  }, [disabled]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-xs text-disabled-text">
        <span>{formatTime(clampedValue)}</span>
        <span>{formatTime(clampedMax)}</span>
      </div>
      <div
        className="relative h-6 touch-none"
        ref={containerRef}
        onMouseDown={onContainerMouseDown}
        onMouseUp={onContainerMouseUp}
        onTouchStart={onContainerTouchStart}
        onTouchEnd={onContainerTouchEnd}
      >
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
          onTouchStart={onStripeTouchStart}
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
          onTouchStart={onPlaybackTouchStart}
        />

        {/* Start marker - "[" brace in text color, perfectly centered */}
        {showStartMarker && (
          <div
            className="absolute pointer-events-none select-none"
            style={{
              left: `${startPercent}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            title={`Start at ${formatTime(clampedSelection)}`}
            aria-label={`Start at ${formatTime(clampedSelection)}`}
          >
            <svg
              className="w-5 h-5 text-default"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M 8 1 L 6 1 L 6 11 L 8 11" />
            </svg>
          </div>
        )}

        {/* End marker - "]" brace in text color, perfectly centered */}
        {showEndMarker && endPercent !== undefined && (
          <div
            className="absolute pointer-events-none select-none"
            style={{
              left: `${endPercent}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            title={`End at ${formatTime(selectionEnd)}`}
            aria-label={`End at ${formatTime(selectionEnd)}`}
          >
            <svg
              className="w-5 h-5 text-default"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M 4 1 L 6 1 L 6 11 L 4 11" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
