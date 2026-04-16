import type { ReactNode } from "react";
import type { PlayerMessage } from "../../../types/MessageTypes";
import { memo, useState } from "react";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../RoomController";
import { PlayerAvatar } from "./PlayerAvatar";
import { UsernameInputField } from "./UsernameInputField";


export const PlayerCard = memo(({
  player,
  children,
}: {
  player: PlayerMessage | null;
  children?: ReactNode;
}) => {
  const controller = useControllerContext();
  const [isEditing, setIsEditing] = useState(false);
  useRoomControllerMessageTypeListener(controller, "update");

  return (
    <li className="flex items-center gap-4 p-3 bg-card-bg rounded-lg">
      <PlayerAvatar size={48} player={player} />
      {player
        ? (
            <div className="flex items-center justify-between flex-1">
              {isEditing
                ? (
                    <UsernameInputField onEnd={(editedName) => {
                      if (editedName !== controller.username) {
                        controller.updateUsername(editedName);
                      }
                      setIsEditing(false);
                    }}
                    />
                  )
                : (
                    <>
                      {player.username === controller.username
                        ? (
                            <button
                              type="button"
                              className="text-lg font-medium wrap-anywhere leading-none cursor-pointer hover:underline text-left"
                              onClick={() => setIsEditing(true)}
                            >
                              {player.username}
                              {" "}
                              (You)
                            </button>
                          )
                        : (
                            <span className="text-lg font-medium wrap-anywhere leading-none">
                              {player.username}
                            </span>
                          )}
                      {children !== undefined
                        && (
                          <span
                            className="text-lg font-medium ml-3 mr-3"
                          >
                            {children}
                          </span>
                        )}
                    </>
                  )}
            </div>
          )
        : (
            <span className="text-lg text-disabled-text">Empty slot</span>
          )}
    </li>
  );
});
