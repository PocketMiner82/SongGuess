import {type ReactNode, useState} from "react";
import {useControllerContext, useRoomControllerMessageTypeListener} from "../RoomController";
import {PlayerAvatar} from "./PlayerAvatar";
import type {PlayerState} from "../../../types/MessageTypes";
import {usernameRegex} from "../../../schemas/ValidationRegexes";
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
  player: PlayerState|null;
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
              if (editedName && editedName !== controller.username && usernameRegex.test(editedName)) {
                controller.updateUsername(editedName);
              }
              setIsEditing(false);
            }} />
          ) : (
            <>
              <span
              className={`text-lg font-medium wrap-anywhere leading-none ${
                player.username === controller.username ? "cursor-pointer hover:underline" : ""
              }`}
              onClick={() => {
                if (player.username === controller.username) {
                  setIsEditing(true);
                }
              }}>
                {player.username + (player.username === controller.username ? " (You)" : "")}
              </span>
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