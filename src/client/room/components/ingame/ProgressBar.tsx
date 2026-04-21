import { useEffect, useRef, useState } from "react";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";


function useProgressLogic(duration: number, offset: number) {
  const [progress, setProgress] = useState(() => {
    if (duration === 0)
      return 0;
    const absoluteDuration = Math.abs(duration);
    const percentage = (offset / absoluteDuration) * 100;
    return duration < 0 ? percentage : 100 - percentage;
  });

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const isReversed = duration < 0;
  const absoluteDuration = Math.abs(duration);

  useEffect(() => {
    if (!absoluteDuration)
      return;

    const offsetMs = offset * 1000;
    startTimeRef.current = performance.now() - offsetMs;

    const animate = (time: number) => {
      if (startTimeRef.current === null)
        return;

      const elapsed = time - startTimeRef.current;
      const linearProgress = Math.min(elapsed / (absoluteDuration * 1000), 1);
      const percentage = linearProgress * 100;

      const finalValue = isReversed ? percentage : 100 - percentage;

      setProgress(Math.max(0, Math.min(100, finalValue)));

      if (linearProgress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [absoluteDuration, offset, isReversed]);

  return absoluteDuration === 0 ? 0 : progress;
}

/**
 * Server-controlled progress bar.
 * @constructor
 */
export function ProgressBar() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "progressbar_update");

  const { progressbarDuration: duration, progressbarOffset: offset } = controller.ingameData;
  const progress = useProgressLogic(duration, offset);

  return (
    <div
      className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-blue-500 transition-none"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
