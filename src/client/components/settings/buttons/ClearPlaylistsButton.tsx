import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../../hooks/RoomControllerListenerHooks";
import { showConfirm } from "../../../util/DialogOpeners";
import { Button } from "../../Button";


/**
 * Button component that clears all playlists after user confirmation.
 */
export function ClearPlaylistsButton({ disabled }: { disabled?: boolean }) {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  const handleClearPlaylists = async () => {
    const isConfirmed = await showConfirm(
      "Clear Playlists",
      "Are you sure you want to clear all playlists?",
    );
    if (isConfirmed) {
      controller.removePlaylist(null);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleClearPlaylists}
      disabled={disabled || controller.playlists.length === 0}
      className="items-center flex justify-center flex-1 text-nowrap"
      aria-label="Clear all playlists"
    >
      <span className="material-symbols-outlined mr-2" aria-hidden="true">delete</span>
      Clear Playlists
    </Button>
  );
}
