import type { PlayerMessage } from "../../../../types/MessageTypes";
import type { PossibleFields } from "./getShowField";
import { useMemo } from "react";
import { COLORS } from "../../../../shared/ConfigConstants";
import { Button } from "../../../components/Button";
import { showConfirm } from "../../../modal/DialogOpeners";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { PlayerCard } from "../player/PlayerCard";
import { getShowField } from "./getShowField";


function BottomText({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`font-medium text-left p-3 text-sm text-disabled-text wrap-break-word ${className ?? ""}`}>
      {children}
    </div>
  );
}

/**
 * Displays all players in the room as a grid. Shows empty slots
 * if there are available colors remaining.
 */
export function PlayerList({ showField, showField2, showField3 }:
{ showField: PossibleFields; showField2?: PossibleFields; showField3?: PossibleFields }) {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  const rankedPlayers = useMemo(() => {
    let msgs: (PlayerMessage | null)[] = [...controller.playerMessages];
    if (controller.state === "ingame") {
      msgs = msgs.sort((a, b) => {
        if (a!.answerData && b!.answerData) {
          return b!.answerData.questionPoints - a!.answerData.questionPoints;
        } else if (a!.answerData && !b!.answerData) {
          return b!.points - a!.points;
        } else if (a!.answerData) {
          return 1;
        } else /* if (!b!.answerData) */ {
          return -1;
        }
      });
    }

    while (msgs.length < COLORS.length) {
      msgs.push(null);
    }

    return msgs;
  }, [controller.playerMessages, controller.state]);

  if (rankedPlayers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xl font-bold w-full">
        Players
        {
          ` (${controller.playerMessages.length}/${COLORS.length}${
            controller.spectatorPlayerMessages.length > 0
              ? ` + ${controller.spectatorPlayerMessages.length} spectator${controller.spectatorPlayerMessages.length > 1 ? "s" : ""}`
              : ""
          })`
        }
      </h3>

      <div className="flex flex-row lg:flex-col gap-3 overflow-y-auto">
        {rankedPlayers.map((player, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={player?.username ?? index} className="flex items-center gap-4 min-w-32">
            <div className="flex-1 flex flex-col bg-card-hover-bg rounded-lg w-full">
              <div className="flex items-center w-full">
                <div className="flex-1">
                  <PlayerCard player={player}>
                    {
                      controller.state !== "ingame"
                        ? controller.isHost && player?.username && player.username !== controller.username
                          ? (
                              <Button
                                onClick={async () => {
                                  const isConfirmed = await showConfirm(
                                    "Transfer Host",
                                    `Do you really want to transfer host to '${player.username}'?`,
                                  );
                                  if (!isConfirmed)
                                    return;

                                  controller.transferHost(player.username);
                                }}
                                aria-label="Transfer host"
                              >
                                <span className="material-symbols-outlined text-2xl" aria-hidden="true">crown</span>
                              </Button>
                            )
                          : undefined
                        : getShowField(player, showField)
                    }
                  </PlayerCard>
                </div>
                { controller.state === "ingame" && getShowField(player, showField2) && (
                  <div className="hidden lg:flex text-lg justify-end font-medium min-w-24">
                    <div className="text-center w-full">
                      {getShowField(player, showField2)}
                    </div>
                  </div>
                )}
              </div>

              { controller.state === "ingame" && getShowField(player, showField2) && (
                <BottomText className="block lg:hidden">
                  {getShowField(player, showField2)}
                </BottomText>
              )}

              {controller.state === "ingame" && getShowField(player, showField3) && (
                <BottomText className="hidden lg:block">
                  {getShowField(player, showField3)}
                </BottomText>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
