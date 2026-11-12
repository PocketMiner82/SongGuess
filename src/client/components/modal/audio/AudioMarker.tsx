import type { ReactNode } from "react";
import { formatTime } from "../../../util/TimeFormatter";


export function AudioMarker({
  markerPositionSeconds,
  markerPositionPercent,
  children,
}: {
  markerPositionSeconds: number;
  markerPositionPercent: number;
  children: ReactNode;
}) {
  return (
    <div
      className="absolute top-1/2 -translate-1/2 pointer-events-none select-none"
      style={{
        left: `${markerPositionPercent}%`,
      }}
      title={`End at ${formatTime(markerPositionSeconds)}`}
      aria-label={`End at ${formatTime(markerPositionSeconds)}`}
    >
      {children}
    </div>
  );
}
