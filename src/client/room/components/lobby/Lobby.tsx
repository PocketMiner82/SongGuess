import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { Settings } from "./LobbySettings";
import { PlayerList } from "./PlayerList";
import { PlaylistsList } from "./PlaylistsList";


/**
 * Main lobby component that only renders when game state is 'lobby'.
 * Organizes player list, playlist management and game start controls.
 */
export function Lobby() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  if (controller.state !== "lobby")
    return null;

  return (
    <div className="lg:max-w-3/4 mx-auto p-4 min-h-full flex flex-col">
      <PlayerList />
      <div className={`grid gap-4 grid-cols-1 flex-1 ${controller.isHost ? "lg:grid-cols-2" : ""}`}>
        <div className="lg:order-last">
          {controller.isHost && <Settings />}
        </div>

        <div className="lg:order-first min-h-0">
          <PlaylistsList />
        </div>
      </div>
    </div>
  );
}
