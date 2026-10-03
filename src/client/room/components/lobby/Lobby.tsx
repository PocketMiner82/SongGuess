import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { Settings } from "./LobbySettings";
import { PlaylistsList } from "./PlaylistsList";


/**
 * Main lobby component that only renders when game state is 'lobby'.
 * Organizes player list, playlist management and game start controls.
 */
export function Lobby() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  if (controller.state !== "lobby")
    return null;

  return (
    <div className="flex flex-col">
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2 flex-1">
        <div className="xl:order-last">
          <Settings disabled={!controller.isHost} />
        </div>

        <div className="xl:order-first min-h-0">
          <PlaylistsList />
        </div>
      </div>
    </div>
  );
}
