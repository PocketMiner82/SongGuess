import type { ReactNode } from "react";
import type { PlayerMessage } from "../../../../types/MessageTypes";
import { memo, useState } from "react";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { PlayerAvatar } from "./PlayerAvatar";
import { UsernameInputField } from "./UsernameInputField";


export const PlayerCard = memo(({
  player,
  children,
  forceDesktop,
}: {
  player: PlayerMessage | null;
  children?: ReactNode;
  forceDesktop?: boolean;
}) => {
  const controller = useControllerContext();
  const [isEditing, setIsEditing] = useState(false);
  useRoomControllerMessageTypeListener(controller, "room_state");

  return (
    <div className={`box-border flex flex-1 flex-col lg:flex-row items-center gap-4 p-3 bg-card-bg rounded-lg
        ${player?.hasPicked ? "border-2 border-success" : ""}
        ${forceDesktop ? "flex-row!" : ""}`}
    >
      <PlayerAvatar size={48} player={player} />
      {player
        ? (
            <div className={`flex flex-col gap-3 lg:flex-row items-center justify-between flex-1 ${forceDesktop ? "flex-row!" : ""}`}>
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
                              className="text-lg font-medium wrap-anywhere leading-none cursor-pointer hover:underline text-center"
                              onClick={() => setIsEditing(true)}
                            >
                              {player.username}
                              {" "}
                              (You)
                            </button>
                          )
                        : (
                            <span className="text-lg font-medium wrap-anywhere leading-none text-center">
                              {player.username}
                            </span>
                          )}
                      {children !== undefined
                        && (
                          <span
                            className="flex text-lg font-medium mx-3"
                          >
                            {children}
                          </span>
                        )}
                    </>
                  )}
            </div>
          )
        : (
            <span className="text-lg text-disabled-text text-center">Empty slot</span>
          )}
    </div>
  );
});
