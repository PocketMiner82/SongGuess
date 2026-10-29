import { useEffect, useState } from "react";
import { GamePhase } from "../../../shared/game/GamePhase";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";

/**
 * Server-controlled progress bar.
 * @constructor
 */
export function ProgressBar() {
  const controller = useControllerContext();
  const [animationKey, setAnimationKey] = useState(0);
  const [firstWarning, setFirstWarning] = useState(false);
  const [continuousWarning, setContinuousWarning] = useState(false);

  useRoomControllerMessageTypeListener(controller, "progressbar_update", () => {
    setFirstWarning(false);
    setContinuousWarning(false);
    setAnimationKey(k => k + 1);
  });

  const { progressbarDuration: duration, progressbarOffset: offset } = controller.questionData;

  const absoluteDuration = Math.abs(duration);
  const isReversed = duration < 0;

  const offsetSeconds = Math.max(0, offset);
  const animationDelay = `-${offsetSeconds}s`;
  const animationDuration = `${absoluteDuration}s`;

  const animationClass = isReversed ? "progress-bar-reversed" : "progress-bar";

  const firstWarningSeconds = Math.max(0, absoluteDuration - offsetSeconds - 30);
  const continuousWarningSeconds = Math.max(0, absoluteDuration - offsetSeconds - 11);

  useEffect(
    () => {
      let firstWarningTimeout: number | null = null;
      let continousWarningTimeout: number | null = null;
      let continuousWarningInterval: number | null = null;

      if (absoluteDuration > 0 && controller.questionData.roundMsg?.gamePhase === GamePhase.PICKING) {
        firstWarningTimeout = window.setTimeout(() => {
          controller.playCountdownRunning();
          setFirstWarning(true);
        }, firstWarningSeconds * 1000);

        continousWarningTimeout = window.setTimeout(() => {
          continuousWarningInterval = window.setInterval(() => {
            setContinuousWarning(true);
            controller.playCountdownRunning();
          }, 1000);
        }, continuousWarningSeconds * 1000);
      } else {
        // eslint-disable-next-line react/set-state-in-effect
        setFirstWarning(false);
        // eslint-disable-next-line react/set-state-in-effect
        setContinuousWarning(false);
      }

      return () => {
        if (firstWarningTimeout) {
          window.clearTimeout(firstWarningTimeout);
        }
        if (continousWarningTimeout) {
          window.clearTimeout(continousWarningTimeout);
        }
        if (continuousWarningInterval) {
          window.clearInterval(continuousWarningInterval);
        }
      };
    },
    // the deps MUST contain animationKey, so that a new listener message clears the intervals and timeouts
    [absoluteDuration, continuousWarningSeconds, controller, controller.questionData.roundMsg?.gamePhase, firstWarningSeconds, animationKey],
  );

  if (absoluteDuration === 0) {
    return (
      <div
        className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-error" style={{ width: "0%" }} />
      </div>
    );
  }

  return (
    <div
      className="w-full h-2 bg-gray-200 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      key={animationKey}
    >
      <div
        className={`h-full transition-colors ease-linear duration-300 ${firstWarning ? `${continuousWarning ? "bg-error" : "bg-warning"}` : "bg-blue-500"} ${animationClass}`}
        style={{
          animationDelay,
          animationDuration,
        }}
      />
    </div>
  );
}
