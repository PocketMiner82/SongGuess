import * as React from "react";
import { toast } from "react-toastify";
import { importPlaylistFile, validatePlaylistsFile } from "../../../../../shared/Utils";
import { Button } from "../../../../components/Button";
import { useControllerContext } from "../../../RoomController";

/**
 * Button component that imports playlists from a JSON file.
 */
export function ImportPlaylistsButton() {
  const controller = useControllerContext();

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const data = await importPlaylistFile(event);
      if (!data) {
        toast.error("Failed to read file.");
        return;
      }

      const playlistsFile = validatePlaylistsFile(data);
      if (!playlistsFile) {
        toast.error("Failed to import playlists. Please check the file format.");
        return;
      }

      controller.importPlaylistsFromFile(playlistsFile);
    } catch {
      toast.error("Failed to read file.");
    }

    // Reset file input
    event.target.value = "";
  };

  return (
    <div>
      <input
        type="file"
        accept=".sgjson"
        onChange={handleImport}
        className="hidden"
        id="playlist-import"
      />
      <Button
        type="button"
        onClick={() => document.getElementById("playlist-import")?.click()}
        className="min-w-full"
        aria-label="Import playlists from file"
      >
        <span className="material-symbols-outlined mr-2" aria-hidden="true">upload</span>
        Import
      </Button>
    </div>
  );
}
