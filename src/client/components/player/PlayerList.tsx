import type { PlayerMessage } from "../../../types/MessageTypes";
import type { PossibleShowFields } from "../../../types/PossibleShowFields";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import React, { useMemo } from "react";
import { COLORS } from "../../../shared/ConfigConstants";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { showConfirm } from "../../util/DialogOpeners";
import { Button } from "../Button";
import { PlayerCard } from "./PlayerCard";
import { AnimatedNumber, PlayerMessageField } from "./PlayerMessageField";


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
      {centerField === "points"
        ? <AnimatedNumber num={player?.points} className="text-xl!" />
        : <PlayerMessageField player={player} showField={centerField} className="text-xl!" />}
      <PlayerMessageField player={player} showField={bottomField} />
    </div>
  );
}

/**
 * Displays all players in the room as a row (a column on wide screens). While
 * ingame they are rendered in ranked order and AutoAnimate slides the cards to
 * their new positions, so re-sorting works regardless of card size.
 */
export function PlayerList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  const players = useMemo(() => {
    const list = [...controller.playerMessages];
    return controller.state !== "lobby"
      ? list.sort((a, b) => b.points - a.points)
      : list;
  }, [controller.playerMessages, controller.state]);

  const [animationParent] = useAutoAnimate<HTMLDivElement>({
    duration: controller.state === "ingame" ? 2000 : 800,
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
  });

  if (players.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 h-full">
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

      <div
        ref={animationParent}
        className="flex-1 flex flex-row justify-center-safe gap-3 overflow-y-hidden overflow-x-auto lg:justify-start lg:overflow-y-auto lg:flex-col"
      >
        {players.map(player => (
          <div
            key={player.uuid}
            className="flex items-center gap-4 min-w-32"
          >
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
