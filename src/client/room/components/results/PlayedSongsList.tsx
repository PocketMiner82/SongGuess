import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { PlaylistCard } from "../PlaylistCard";

/**
 * Component for displaying list of songs played during the game round.
 * Shows all songs that were played with their title, artist, and cover art.
 */
export function PlayedSongsList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_played_songs");

  return controller.playedSongs.length > 0 && (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-4 text-center">
        Played Songs
      </h3>
      <div className="space-y-2 mx-auto">
        {controller.playedSongs.map((song, idx) => (
          song
            ? (
                <PlaylistCard
                  key={idx}
                  title={song.name}
                  subtitle={song.artist}
                  coverURL={song.cover}
                  hrefURL={song.hrefURL}
                />
              )
            : (
                <PlaylistCard
                  key={idx}
                  title="(Skipped Round)"
                />
              )
        ))}
      </div>
    </div>
  );
}
