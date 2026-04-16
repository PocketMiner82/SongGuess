import {type ReactNode, useState} from "react";
import {useControllerContext, useRoomControllerMessageTypeListener} from "../RoomController";
import {PlayerAvatar} from "./PlayerAvatar";
import type {PlayerMessage} from "../../../types/MessageTypes";
import {UsernameInputField} from "./UsernameInputField";

/**
 * Interactive list entry for a single player. Allows the current user
 * to edit their username by clicking on it.
 *
 * @param player The player's state or null for empty slot
 * @param children children to show on the card
 */
export function PlayerCard({
  player,
  children
}: {
  player: PlayerMessage|null;
  children?: ReactNode
}) {
  const controller = useControllerContext();
  const [isEditing, setIsEditing] = useState(false);
  useRoomControllerMessageTypeListener(controller, "update");

  return (
    <li className="flex items-center gap-4 p-3 bg-card-bg rounded-lg">
      <PlayerAvatar size={48} player={player} />
      {player ? (
        <div className="flex items-center justify-between flex-1">
          {isEditing ? (
            <UsernameInputField onEnd={(editedName) => {
              if (editedName !== controller.username) {
                controller.updateUsername(editedName);
              }
              setIsEditing(false);
            }} />
          ) : (
            <>
              {player.username === controller.username ? (
                <button
                  type="button"
                  className="text-lg font-medium wrap-anywhere leading-none cursor-pointer hover:underline text-left"
                  onClick={() => setIsEditing(true)}
                >
                  {player.username} (You)
                </button>
              ) : (
                <span className="text-lg font-medium wrap-anywhere leading-none">
                  {player.username}
                </span>
              )}
              {children !== undefined &&
                <span
                className="text-lg font-medium ml-3 mr-3">
                  {children}
                </span>
              }
            </>
          )}
        </div>
      ) : (
        <span className="text-lg text-disabled-text">Empty slot</span>
      )}
    </li>
  );
}