import {memo, useEffect, useRef, useState} from "react";

/**
 * Progress bar component that shows time remaining for the current question.
 */
export const ProgressBar = memo(function ProgressBar({
                                                duration,
                                                isPlaying,
                                                positionOffset = 0
                                              }: {
  duration: number;
  isPlaying: boolean;
  positionOffset?: number;
}) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying && duration) {
      let reversed = false;
      if (duration < 0) {
        reversed = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
        duration = -duration;
      }

      // Calculate initial progress based on position offset
      const offsetProgress = (positionOffset / duration) * 100;
      const initialProgress = reversed ? offsetProgress : (100 - offsetProgress);
      setProgress(Math.max(0, Math.min(100, initialProgress)));

      // Update progress every 100ms for smooth animation
      const intervalTime = 100;
      const change = (100 / duration) * (intervalTime / 1000);

      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (reversed) {
            const newProgress = prev + change;
            return newProgress >= 100 ? 100 : newProgress;
          } else {
            const newProgress = prev - change;
            return newProgress <= 0 ? 0 : newProgress;
          }
        });
      }, intervalTime);
    } else {
      // Clear interval when not playing
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration, positionOffset]);

  return (
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
            className="h-full bg-blue-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
        />
      </div>
  );
});