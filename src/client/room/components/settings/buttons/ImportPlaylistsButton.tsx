import * as React from "react";
import { useRef } from "react";
import { toast } from "react-toastify";
import { importPlaylistFile, validatePlaylistsFile } from "../../../../../shared/Utils";
import { Button } from "../../../../components/Button";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";


/**
 * Button component that imports playlists from a JSON file.
 */
export function ImportPlaylistsButton({ disabled }: { disabled?: boolean }) {
  const controller = useControllerContext();
  const playlistImportRef = useRef<HTMLInputElement>(null);

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
    <div className="flex-1">
      <input
        ref={playlistImportRef}
        type="file"
        accept=".sgjson"
        onChange={handleImport}
        className="hidden"
      />
      <Button
        type="button"
        disabled={disabled}
        onClick={() => playlistImportRef.current?.click()}
        className="w-full text-nowrap"
        aria-label="Import playlists from file"
      >
        <span className="material-symbols-outlined mr-2" aria-hidden="true">upload</span>
        Import Playlist File
      </Button>
    </div>
  );
}
