import type { ServerMessage } from "../../../types/MessageTypes";
import { useCallback, useState } from "react";
import { useControllerContext } from "../hooks/RoomControllerHooks";
import { useRoomControllerListener } from "../hooks/RoomControllerListenerHooks";

/**
 * Countdown overlay component that displays a countdown number centered on screen.
 * Listens for countdown messages from the server and shows/hides accordingly.
 */
export function Countdown() {
  const [countdown, setCountdown] = useState(0);
  const visible = countdown > 0;

  useRoomControllerListener(useControllerContext(), useCallback((msg: ServerMessage | null) => {
    if (msg && msg.type === "countdown") {
      setCountdown(msg.countdown);
    }
    return false;
  }, []));

  return visible
    ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85" aria-live="polite">
          <div className="text-white text-9xl font-bold">{countdown}</div>
        </div>
      )
    : null;
}
