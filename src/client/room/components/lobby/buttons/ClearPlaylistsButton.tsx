import { Button } from "../../../../components/Button";
import { showConfirm } from "../../../../modal/DialogOpeners";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../../RoomController";

/**
 * Button component that clears all playlists after user confirmation.
 */
export function ClearPlaylistsButton() {
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
      disabled={controller.playlists.length === 0}
      className="items-center flex justify-center"
      aria-label="Clear all playlists"
    >
      <span className="material-symbols-outlined mr-2" aria-hidden="true">delete</span>
      Clear Playlists
    </Button>
  );
}
