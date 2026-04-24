import { Button } from "../../../components/Button";
import { PlaylistCard } from "../../../components/PlaylistCard";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { DownloadPlaylistsButton } from "./buttons/DownloadPlaylistsButton";

/**
 * Lists all added playlists in a vertical stack. Shows a placeholder
 * message when no playlists are available.
 */
export function PlaylistsList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "update_playlists");
  useRoomControllerMessageTypeListener(controller, "room_config");

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold">
          Playlists -
          {
            ` ${controller.filteredSongsCount} song${controller.filteredSongsCount !== 1 ? "s" : ""} ${controller.config.advancedSongFiltering ? " (filtered)" : ""}`
          }
        </h3>
        <DownloadPlaylistsButton />
      </div>
      <ul className="space-y-4 overflow-auto flex-1">
        {controller.playlists.length === 0
          ? (
              <PlaylistCard title="No playlists added yet." />
            )
          : (
              controller.playlists.map((pl, idx) => (
                <PlaylistCard
                  key={idx}
                  title={pl.name}
                  subtitle={pl.subtitle}
                  coverURL={pl.cover}
                  hrefURL={pl.hrefURL}
                >
                  {
                    controller.isHost
                      ? (
                          <Button
                            type="button"
                            onClick={() => controller.removePlaylist(idx)}
                            aria-label="Delete playlist"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                          </Button>
                        )
                      : undefined
                  }
                </PlaylistCard>
              ))
            )}
      </ul>
    </div>
  );
}
