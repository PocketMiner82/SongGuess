import {usernameRegex} from "../../../schemas/ValidationRegexes";
import {useCallback, useState} from "react";
import {useControllerContext, useRoomControllerListener} from "../RoomController";
import {Button} from "../../components/Button";


/**
 * Input field component for editing and submitting a username.
 * Supports both enter-key submission and button-based submission.
 * Automatically validates the username against the username regex and updates visually on valid/invalid state.
 *
 * @param onEnd - Callback function called when the user submits a valid username
 * @param requireEnter - If true, requires pressing Enter to submit; otherwise submits on blur
 * @param showButton - If true, displays a "Join Game" button alongside the input field
 * @constructor
 */
export function UsernameInputField({onEnd, requireEnter, showButton}: {onEnd: (editedName: string) => void, requireEnter?: boolean, showButton?: boolean}) {
  const controller = useControllerContext();
  const [editedName, setEditedName] = useState(controller.username ?? "");

  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg?.type === "update" && msg.username !== editedName) {
      setEditedName(msg.username);
    }
    return false;
  }, [editedName]));

  const handleNameUpdate = useCallback(() => {
    if (editedName && editedName !== controller.username && usernameRegex.test(editedName)) {
      onEnd(editedName);
    }
  }, [controller.username, editedName, onEnd]);

  return (
      <div className="flex w-full">
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={() => !requireEnter && handleNameUpdate()}
          onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
          autoFocus
          maxLength={16}
          className={`text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none ${showButton ? "flex-1" : "w-full"}
                ${usernameRegex.test(editedName ?? "") ? "focus:border-secondary" : "focus:border-error"}`}/>
        {showButton ?
            <Button className="ml-2" onClick={handleNameUpdate}>
              Join Game
            </Button>
             : undefined}
      </div>
  );
}