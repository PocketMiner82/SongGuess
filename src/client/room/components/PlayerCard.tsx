import {memo, useState} from "react";
import type {PlayerState} from "../../../schemas/RoomServerMessageSchemas";
import {useControllerContext} from "../RoomController";
import {PlayerAvatar} from "./PlayerAvatar";

/**
 * Interactive list entry for a single player. Allows the current user
 * to edit their username by clicking on it.
 *
 * @param player The player's state or null for empty slot
 * @param username The current user's username
 * @param showPoints Whether to show the points in the player object.
 */
export const PlayerCard = memo(function PlayerCard({
  player,
  username,
  showPoints = false
}: {
  player: PlayerState|null;
  username?: string|undefined;
  showPoints?: boolean;
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
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameUpdate}
            onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
            autoFocus
            maxLength={16}
            className="text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none focus:border-secondary"/>
          ) : (
            <>
              <span
              className={`text-lg font-medium w-full ${player.username === username ? "cursor-pointer hover:underline" : ""}`}
              onClick={() => {
                if (player.username === username) {
                  setEditedName(username);
                  setIsEditing(true);
                }
              }}>
                {player.username + (player.username === username ? " (You)" : "")}
              </span>
              {showPoints ? (
                <span
                className="text-lg font-medium text-right">
                  {player.points}
                </span>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <span className="text-lg text-disabled-text">Empty slot</span>
      )}
    </li>
  );
});