import { Button } from "../../../../components/Button";
import { Modal } from "../../../../modal/Modal";
import { SearchMusicDialog } from "../../../../modal/SearchMusicDialog";
import { useControllerContext } from "../../../RoomController";

/**
 * Button component that opens the search dialog for adding playlists.
 */
export function AddPlaylistButton() {
  const controller = useControllerContext();

  return (
    <Button
      onClick={() => Modal.open(SearchMusicDialog, {
        onPlaylistSelected: async (url) => {
          console.debug("Selected Playlist:", url);
          return await controller.tryAddPlaylists(url);
        },
        id: "LobbySearchMusicDialog",
      })}
      className="w-full"
    >
      <span className="material-symbols-outlined mr-2">add</span>
      Add Playlist
    </Button>
  );
}
