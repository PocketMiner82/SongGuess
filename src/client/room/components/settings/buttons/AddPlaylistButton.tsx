import { Button } from "../../../../components/Button";
import { SearchMusicDialog } from "../../../../components/modal/SearchMusicDialog";
import { Modal } from "../../../../modal/Modal";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";


/**
 * Button component that opens the search dialog for adding playlists.
 */
export function AddPlaylistButton({ disabled }: { disabled?: boolean }) {
  const controller = useControllerContext();

  return (
    <Button
      disabled={disabled}
      onClick={() => Modal.open(SearchMusicDialog, {
        onPlaylistSelected: async (playlist) => {
          if (playlist.songs.length > 0) {
            console.debug("Selected Playlist:", playlist);
            controller.addPlaylists(playlist);
            return true;
          }

          return false;
        },
        id: "LobbySearchMusicDialog",
      })}
      className="flex-1 text-nowrap"
    >
      <span className="material-symbols-outlined mr-2">add</span>
      Add Playlist
    </Button>
  );
}
