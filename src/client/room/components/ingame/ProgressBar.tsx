import { useState } from "react";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";

/**
 * Server-controlled progress bar.
 * @constructor
 */
export function ProgressBar() {
  const controller = useControllerContext();
  const [animationKey, setAnimationKey] = useState(0);

  useRoomControllerMessageTypeListener(controller, "progressbar_update", () => {
    setAnimationKey(k => k + 1);
  });

  const { progressbarDuration: duration, progressbarOffset: offset } = controller.questionData;

  const absoluteDuration = Math.abs(duration);
  const isReversed = duration < 0;

  if (absoluteDuration === 0) {
    return (
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-blue-500" style={{ width: "0%" }} />
      </div>
    );
  }

  const offsetSeconds = Math.max(0, offset);
  const animationDelay = `-${offsetSeconds}s`;
  const animationDuration = `${absoluteDuration}s`;

  const animationClass = isReversed ? "progress-bar-reversed" : "progress-bar";

  return (
    <div
      className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      key={animationKey}
    >
      <div
        className={`h-full bg-blue-500 ${animationClass}`}
        style={{
          animationDelay,
          animationDuration,
        }}
      />
    </div>
  );
}
