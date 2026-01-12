import {memo, type ReactNode, useState} from "react";
import type {PlayerState} from "../../../schemas/RoomServerMessageSchemas";
import {useControllerContext} from "../RoomController";
import {PlayerAvatar} from "./PlayerAvatar";
import {UsernameRegex} from "../../../schemas/RoomSharedSchemas";

/**
 * Interactive list entry for a single player. Allows the current user
 * to edit their username by clicking on it.
 *
 * @param player The player's state or null for empty slot
 * @param username The current user's username
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  username,
  children
}: {
  player: PlayerState|null;
  username?: string|undefined;
  children?: ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(username);
  const controller = useControllerContext();

  const handleNameUpdate = () => {
    if (editedName && editedName.trim() && editedName.trim() !== username) {
      controller.updateUsername(editedName.trim());
    }
    setIsEditing(false);
  };

  return (
    <li className="flex items-center gap-4 p-3 bg-card-bg rounded-lg">
      <PlayerAvatar size={48} player={player} />
      {player ? (
        <div className="flex items-center justify-between flex-1">
          {isEditing ? (
            <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameUpdate}
            onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
            autoFocus
            maxLength={16}
            className={`text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none 
              ${UsernameRegex.test(editedName ?? "") ? "focus:border-secondary" : "focus:border-error"}`}/>
          ) : (
            <>
              <span
              className={`text-lg font-medium ${player.username === username ? "cursor-pointer hover:underline" : ""}`}
              onClick={() => {
                if (player.username === username) {
                  setEditedName(username);
                  setIsEditing(true);
                }
              }}>
                {player.username + (player.username === username ? " (You)" : "")}
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
});