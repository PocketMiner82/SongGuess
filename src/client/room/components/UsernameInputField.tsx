import {usernameRegex} from "../../../schemas/ValidationRegexes";
import {useCallback, useState} from "react";
import {useControllerContext, useRoomControllerListener} from "../RoomController";
import {Button} from "../../components/Button";


/**
 *
 * @param onEnd
 * @param requireEnter
 * @param showButton
 * @constructor
 */
export function UsernameInputField({onEnd, requireEnter, showButton}: {onEnd?: (editedName: string) => void, requireEnter?: boolean, showButton?: boolean}) {
  const controller = useControllerContext();
  const [editedName, setEditedName] = useState(controller.username ?? "");

  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg?.type === "update" && msg.username !== editedName) {
      setEditedName(msg.username);
    }
    return false;
  }, [editedName]));

  const handleNameUpdate = useCallback(() => {
    onEnd?.(editedName);
  }, [editedName, onEnd]);

  return (
      <>
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={() => !requireEnter && handleNameUpdate()}
          onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
          autoFocus
          maxLength={16}
          className={`text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none w-max
                ${usernameRegex.test(editedName ?? "") ? "focus:border-secondary" : "focus:border-error"}`}/>
        {showButton ?
            <Button className="ml-2" onClick={handleNameUpdate}>
              Join Game
            </Button>
            : undefined}
      </>
  );
}