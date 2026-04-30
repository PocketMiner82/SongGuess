import { Button } from "../../../components/Button";
import { showConfirm } from "../../../modal/DialogOpeners";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { PlayerCard } from "../PlayerCard";

/**
 * Displays all players in the room as a grid. Shows empty slots
 * if there are available colors remaining.
 */
export function PlayerList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  return (
    <div className="flex flex-wrap gap-3 mb-8">
      <h3 className="text-xl font-bold w-full">Players</h3>
      {controller.playerMessages.map(player => (
        <PlayerCard key={player.username} player={player}>
          {controller.isHost && player?.username && player.username !== controller.username
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
            : undefined}
        </PlayerCard>
      ))}
    </div>
  );
}
