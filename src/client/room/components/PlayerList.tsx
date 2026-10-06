import type { PlayerMessage } from "../../../types/MessageTypes";
import type { PossibleShowFields } from "../../../types/PossibleShowFields";
import { useMemo } from "react";
import { COLORS } from "../../../shared/ConfigConstants";
import { Button } from "../../components/Button";
import { showConfirm } from "../../modal/DialogOpeners";
import { useControllerContext } from "../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../hooks/RoomControllerListenerHooks";
import { PlayerCard } from "./player/PlayerCard";
import { PlayerMessageField } from "./PlayerMessageField";


function BottomText({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`font-medium text-left p-3 text-sm text-disabled-text wrap-break-word ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function InnerText({ player, topField, centerField, bottomField }:
{
  player: PlayerMessage | null;
  topField?: PossibleShowFields;
  centerField?: PossibleShowFields;
  bottomField?: PossibleShowFields;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-16 lg:min-h-20 pt-1 lg:pt-0 lg:pl-1 justify-center items-center lg:items-end border-border border-t lg:border-t-0 lg:border-l">
      <PlayerMessageField player={player} showField={topField} />
      <PlayerMessageField player={player} showField={centerField} className="text-xl!" />
      <PlayerMessageField player={player} showField={bottomField} />
    </div>
  );
}

/**
 * Displays all players in the room as a grid. Shows empty slots
 * if there are available colors remaining.
 */
export function PlayerList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  const rankedPlayers = useMemo(() => {
    let msgs: (PlayerMessage | null)[] = [...controller.playerMessages];
    if (controller.state === "ingame") {
      msgs = msgs.sort((a, b) => {
        if (a!.answerData && b!.answerData) {
          return b!.answerData.questionPoints - a!.answerData.questionPoints;
        }

        if (a!.answerData && !b!.answerData) {
          return -1;
        }
        if (!a!.answerData && b!.answerData) {
          return 1;
        }

        return b!.points - a!.points;
      });
    }

    // while (msgs.length < COLORS.length) {
    //   msgs.push(null);
    // }

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

      <div className="flex flex-row justify-center lg:flex-col gap-3 overflow-y-auto">
        {rankedPlayers.map((player, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={player?.username ?? index} className="flex items-center gap-4 min-w-32">
            <div className="flex-1 flex flex-col bg-card-hover-bg rounded-lg w-full">
              <PlayerCard player={player}>
                {
                  controller.state !== "ingame"
                    ? (controller.isHost && player?.username && player.username !== controller.username
                      && (
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
                          <span className="material-symbols-outlined" aria-hidden="true">crown</span>
                        </Button>
                      ))
                    : (
                        <InnerText
                          player={player}
                          topField="questionPoints"
                          centerField="points"
                          bottomField="answerSpeed"
                        />
                      )
                }
              </PlayerCard>

              {controller.state === "ingame" && PlayerMessageField({ player, showField: "answer" }) && (
                <BottomText className="hidden lg:block max-h-16 overflow-y-auto">
                  <PlayerMessageField player={player} showField="answer" />
                </BottomText>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
