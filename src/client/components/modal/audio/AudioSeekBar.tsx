import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { formatTime } from "../../../util/TimeFormatter";
import { AudioMarker } from "./AudioMarker";


interface AudioSeekBarProps {
  playbackPositionSeconds: number;
  selectionStartSeconds: number;
  durationSeconds: number;
  guesstimeEndSeconds?: number;
  audioPlaytimeSeconds?: number;
  disabled?: boolean;
  // selection start changed (moving the stripe)
  onChange: (selectionStart: number) => void;
  // playback position changed (circular handle drag)
  onSeek: (playbackPosition: number) => void;
}


export function AudioSeekBar({
  playbackPositionSeconds,
  selectionStartSeconds,
  durationSeconds,
  guesstimeEndSeconds,
  audioPlaytimeSeconds,
  disabled = false,
  onChange,
  onSeek,
}: AudioSeekBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: "stripe" | "playback";
    rect: DOMRect;
    valueOffset?: number;
  } | null>(null);


  const clampedDuration = Math.max(durationSeconds, 0);

  const maxStartSeconds = audioPlaytimeSeconds !== undefined
    ? Math.max(0, clampedDuration - audioPlaytimeSeconds)
    : clampedDuration;

  const clampedPlaybackPositionSeconds = clampedDuration > 0
    ? Math.min(Math.max(playbackPositionSeconds, 0), clampedDuration)
    : 0;
  const clampedSelectionStartSeconds = maxStartSeconds > 0
    ? Math.min(Math.max(selectionStartSeconds, 0), maxStartSeconds)
    : 0;

  const playbackPositionPercent = clampedDuration > 0
    ? (clampedPlaybackPositionSeconds / clampedDuration) * 100
    : 0;

  // Stripe length in percent = audioPlayTime / max
  const stripeWidthPercent = useMemo(() => {
    if (!audioPlaytimeSeconds || clampedDuration <= 0) {
      return 0;
    }
    return Math.min((audioPlaytimeSeconds / clampedDuration) * 100, 100);
  }, [audioPlaytimeSeconds, clampedDuration]);

  const guesstimeEndPercent = useMemo(() => {
    if (!guesstimeEndSeconds || clampedDuration <= 0) {
      return undefined;
    }
    const endClamped = Math.min(Math.max(guesstimeEndSeconds, 0), clampedDuration);
    return (endClamped / clampedDuration) * 100;
  }, [clampedDuration, guesstimeEndSeconds]);

  const selectionStartPercent = clampedDuration > 0
    ? (clampedSelectionStartSeconds / clampedDuration) * 100
    : 0;

  const showStartMarker = clampedDuration > 0;
  const showEndMarker = guesstimeEndSeconds !== undefined && clampedDuration > 0 && guesstimeEndSeconds > 0 && guesstimeEndSeconds <= clampedDuration;
  const isDisabled = disabled || clampedDuration <= 0;

  const getValueFromPosition = useCallback((clientX: number): number => {
    const rect = dragRef.current?.rect ?? containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) {
      return 0;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const pos = x * clampedDuration;

    return Math.min(Math.max(pos - (dragRef.current?.valueOffset ?? 0), 0), clampedDuration);
  }, [clampedDuration]);

  const onDrag = useCallback((clientX: number) => {
    if (disabled || !dragRef.current) {
      return;
    }
    const val = getValueFromPosition(clientX);
    if (dragRef.current.mode === "stripe") {
      onChange(Math.min(val, maxStartSeconds));
    } else {
      onSeek(val);
    }
  }, [
    disabled,
    getValueFromPosition,
    maxStartSeconds,
    onChange,
    onSeek,
  ]);

  const onPointerUp = useCallback((e?: PointerEvent) => {
    if (dragRef.current) {
      e?.stopPropagation();
      dragRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onCancel = () => onPointerUp();
    const onPointerMove = (e: PointerEvent) => onDrag(e.clientX);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onCancel);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [onDrag, onPointerUp]);

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>, mode: "stripe" | "playback", clientXStart?: number) => {
    if (disabled || !containerRef.current) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    // when computing valueOffset, getValueFromPosition(clientXStart) would be called before assigning the new dragRef.current.
    // if previous drag left dragRef.current non-null (e.g. pointerup missed), offset calc would read stale valueOffset
    dragRef.current = null;
    dragRef.current = {
      mode,
      rect: containerRef.current.getBoundingClientRect(),
      valueOffset: clientXStart
        ? Math.max(0, getValueFromPosition(clientXStart) - clampedSelectionStartSeconds)
        : 0,
    };

    onDrag(e.clientX);
  }, [
    disabled,
    getValueFromPosition,
    clampedSelectionStartSeconds,
    onDrag,
  ]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-xs text-disabled-text">
        <span>{formatTime(clampedPlaybackPositionSeconds)}</span>
        <span>{formatTime(clampedDuration)}</span>
      </div>
      <div
        className="relative cursor-pointer h-6 touch-none"
        ref={containerRef}
        onPointerDown={e => onDragStart(e, "stripe")}
      >
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-500" />

        <div
          className="absolute top-1/2 -translate-y-1/2 h-6 cursor-pointer"
          style={{
            left: `${selectionStartPercent}%`,
            width: `${stripeWidthPercent}%`,
          }}
          onPointerDown={e => onDragStart(e, "stripe", e.clientX)}
        >
          <div
            className="relative top-1/2 -translate-y-1/2 h-1.5 w-full rounded-full bg-primary cursor-pointer"
          />
        </div>

        <div
          className={`absolute top-1/2 -translate-1/2 w-4 h-4 rounded-full bg-secondary border-2 border-white
                      shadow-sm cursor-pointer ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{
            left: `${playbackPositionPercent}%`,
          }}
          onPointerDown={e => onDragStart(e, "playback")}
        />

        {showStartMarker && (
          <AudioMarker markerPositionSeconds={clampedSelectionStartSeconds} markerPositionPercent={selectionStartPercent}>
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
          </AudioMarker>
        )}

        {showEndMarker && guesstimeEndPercent !== undefined && (
          <AudioMarker markerPositionSeconds={guesstimeEndSeconds} markerPositionPercent={guesstimeEndPercent}>
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
          </AudioMarker>
        )}
      </div>
    </div>
  );
}
