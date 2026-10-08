import { downloadFile, formatLocalDateTime } from "../../../../shared/Utils";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../../hooks/RoomControllerListenerHooks";
import { Button } from "../../Button";


/**
 * Button component that downloads the current playlists as a JSON file.
 */
export function DownloadPlaylistsButton() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  const handleDownload = () => {
    const content = controller.generatePlaylistsFile();
    downloadFile(content, `SongGuessPlaylists_${formatLocalDateTime(new Date())}.sgjson`);
  };

  return (
    <Button
      type="button"
      onClick={handleDownload}
      disabled={controller.playlists.length === 0}
      className="items-center flex justify-center"
      aria-label="Download playlists"
    >
      <span className="material-symbols-outlined" aria-hidden="true">download</span>
    </Button>
  );
}
