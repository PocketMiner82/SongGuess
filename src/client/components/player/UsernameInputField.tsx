import { useCallback, useState } from "react";
import { usernameRegex } from "../../../schemas/ValidationRegexes";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerListener } from "../../hooks/RoomControllerListenerHooks";
import { Button } from "../Button";

/**
 * Input field component for editing and submitting a username.
 * Supports both enter-key submission and button-based submission.
 * Automatically validates the username against the username regex and updates visually on valid/invalid state.
 *
 * @param onEnd - Callback function called when the user submits a valid username
 * @param requireEnter - If true, requires pressing Enter to submit; otherwise submits on blur
 * @param showButton - If true, also displays join and spectator buttons
 * @constructor
 */
export function UsernameInputField({ onEnd, requireEnter, showButtons }: { onEnd: (editedName: string, spectator: boolean) => void; requireEnter?: boolean; showButtons?: boolean }) {
  const controller = useControllerContext();
  const [controllerUsername, setControllerUsername] = useState(controller.username ?? "");
  const [editedName, setEditedName] = useState(controller.username ?? "");

  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg?.type === "room_state" && controller.username !== undefined && controller.username !== controllerUsername) {
      setControllerUsername(controller.username);
      setEditedName(controller.username);
    }
    return false;
  }, [controller.username, controllerUsername]));

  const handleNameUpdate = useCallback((spectator: boolean) => {
    if (editedName && usernameRegex.test(editedName)) {
      onEnd(editedName, spectator);
    }
  }, [editedName, onEnd]);

  return (
    <div className="w-full">
      <label htmlFor="username-input" className="sr-only">Username</label>
      <input
        id="username-input"
        type="text"
        value={editedName}
        onChange={e => setEditedName(e.target.value)}
        onBlur={() => !requireEnter && handleNameUpdate(false)}
        onKeyDown={e => e.key === "Enter" && handleNameUpdate(false)}
        autoComplete="username"
        spellCheck={false}
        autoFocus={true}
        maxLength={16}
        className={`text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none w-full
                ${usernameRegex.test(editedName ?? "") ? "focus:border-secondary" : "focus:border-error"}`}
      />
      {showButtons
        ? (
            <div className="flex flex-col gap-2 mt-4">
              <Button className="w-full" onClick={() => handleNameUpdate(false)}>
                Join Game
              </Button>
              <Button
                className="w-full bg-secondary hover:bg-secondary-hover"
                onClick={() => handleNameUpdate(true)}
              >
                Join as Spectator
              </Button>
            </div>
          )
        : undefined}
    </div>
  );
}
