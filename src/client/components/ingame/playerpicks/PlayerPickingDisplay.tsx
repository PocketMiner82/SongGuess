import type { Playlist } from "../../../../types/MessageTypes";
import type { ListenerCallback } from "../../../hooks/RoomControllerListenerHooks";
import { useCallback, useState } from "react";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import { useRoomControllerListener } from "../../../hooks/RoomControllerListenerHooks";
import { PlaylistCard } from "../../PlaylistCard";
import { SearchMusicComponent } from "../../SearchMusicComponent";
import { SettingsRange } from "../../settings/SettingsRange";


export function PlayerPickingDisplay() {
  const controller = useControllerContext();
  const [audioStartPos, setAudioStartPos] = useState(() => controller.config.audioStartPosition ?? 0);
  useRoomControllerListener(controller, useCallback((msg) => {
    return msg?.type === "confirmation" && msg.sourceMessage.type === "player_pick_song";
  }, []));

  const pickedSong = controller.questionData.pickedSong;

  const handlePickSong = useCallback(async (playlist: Playlist) => {
    if (playlist.songs.length > 0 && !pickedSong) {
      controller.pickSong(playlist.songs[0], audioStartPos);

      return new Promise<boolean>((resolve) => {
        let timeoutId: NodeJS.Timeout;

        const successListener: ListenerCallback = (msg) => {
          if (msg?.type === "confirmation" && msg.sourceMessage.type === "player_pick_song") {
            clearTimeout(timeoutId);
            controller.unregisterOnStateChangeListener(successListener);
            resolve(msg.error === undefined);
          }
        };

        timeoutId = setTimeout(() => {
          controller.unregisterOnStateChangeListener(successListener);
          resolve(false);
        }, 10000);

        controller.registerOnStateChangeListener(successListener);
      });
    }

    return false;
  }, [audioStartPos, controller, pickedSong]);

  return (
    <div className="space-y-6 w-full">
      { !pickedSong
        ? (
            <div>
              {controller.config.audioStartPosition === null && (
                <SettingsRange
                  value={audioStartPos}
                  onChange={(v) => {
                    setAudioStartPos(v);
                  }}
                  displayText={`${Math.round((audioStartPos) * 100)}%`}
                >
                  Start song at
                </SettingsRange>
              )}

              <div className="mt-2 flex justify-center max-h-[calc(100vh-21rem)] min-h-0">
                <SearchMusicComponent
                  onlyAcceptSongs={true}
                  onPlaylistSelected={handlePickSong}
                  audioStartPos={audioStartPos}
                />
              </div>
            </div>
          )
        : (
            <>
              <div className="text-disabled-text text-center mb-2">
                <p>Song submitted!</p>
                <p>Waiting for other players to pick...</p>
              </div>
              <PlaylistCard
                title={pickedSong.name}
                subtitle={pickedSong.artist}
                coverURL={pickedSong.cover}
                hrefURL={pickedSong.hrefURL}
              />
            </>

          )}
    </div>
  );
}
