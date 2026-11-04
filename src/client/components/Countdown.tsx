import type { ServerMessage } from "../../types/MessageTypes";
import { useCallback, useEffect, useState } from "react";
import { useControllerContext } from "../hooks/RoomControllerHooks";
import { useRoomControllerListener } from "../hooks/RoomControllerListenerHooks";

/**
 * Countdown overlay component that displays a countdown number centered on screen.
 * Listens for countdown messages from the server and shows/hides accordingly.
 */
export function Countdown() {
  const controller = useControllerContext();
  const [countdown, setCountdown] = useState(0);
  const visible = countdown > 0;

  useRoomControllerListener(controller, useCallback((msg: ServerMessage | null) => {
    if (msg && msg.type === "countdown") {
      controller[msg.countdown > 0 ? "playCountdownRunning" : "playCountdownEnd"]();
      setCountdown(msg.countdown);
    }
    return false;
  }, [controller]));

  useEffect(() => {
    let timeout: number | null = null;
    if (countdown > 1) {
      timeout = window.setTimeout(() => {
        controller.playCountdownRunning();
        setCountdown(countdown - 1);
      }, 1000);
    }

    return () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [controller, countdown]);

  return visible
    ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85" aria-live="polite">
          <div key={countdown} className="countdown-zoom text-white text-9xl font-bold">{countdown}</div>
        </div>
      )
    : null;
}
