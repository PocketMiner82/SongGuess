import type { Playlist } from "../../../../types/MessageTypes";
import { useCallback, useEffect, useState } from "react";
import { useModalWindow } from "react-modal-global";
import { QUESTION_PADDING_TICKS } from "../../../../shared/ConfigConstants";
import { GamePhase } from "../../../../shared/game/GamePhase";
import { useAudioPlayerContext } from "../../../hooks/audio/AudioPlayerContext";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../../hooks/RoomControllerListenerHooks";
import { Button } from "../../Button";
import { PlaylistCard } from "../../PlaylistCard";
import { ModalContent } from "../ModalContent";
import { AudioSeekBar } from "./AudioSeekBar";


export interface PlayerPickSongDialogProps {
  playlist: Playlist;
  onSubmit: (audioStartPos: number) => Promise<void> | void;
}

export function PlayerPickSongDialog({
  playlist,
  onSubmit,
}: PlayerPickSongDialogProps) {
  const modal = useModalWindow();
  const controller = useControllerContext();
  const { player, state } = useAudioPlayerContext();

  // Subscribe to modal close once via useEffect so we don't accumulate
  // pause() listeners on every render. Calling modal.then() directly in
  // the render body registers a new listener each render; when the modal
  // eventually closes, all accumulated listeners fire pause() at once,
  // interrupting playback setup for the next song.
  useEffect(() => {
    const unsubscribe = modal.on("close", () => {
      player.howler?.pause();
    });
    return unsubscribe;
  }, [modal, player]);

  useRoomControllerMessageTypeListener(controller, "room_config");
  useRoomControllerMessageTypeListener(controller, "round_state");

  const audioPlayTime = controller.config.timePerQuestion + QUESTION_PADDING_TICKS;
  const isFixed = controller.config.audioStartPosition !== null;

  const duration = player.howler?.duration() ?? 0;
  const [startPosSeconds, setStartPosSeconds] = useState(0);

  const maxStartSeconds = Math.max(0, duration - audioPlayTime);
  const clampedEndSeconds = duration > 0
    ? Math.min(startPosSeconds + audioPlayTime, duration)
    : startPosSeconds + audioPlayTime;

  // Update start position when song changes
  useEffect(() => {
    setStartPosSeconds(0);
  }, [playlist.songs]);

  useEffect(() => {
    if (controller.questionData.roundMsg?.gamePhase !== GamePhase.PICKING) {
      modal.close();
    }
  }, [controller.questionData.roundMsg?.gamePhase, modal]);

  const handleSeekChange = useCallback((value: number) => {
    if (isFixed || duration <= 0) {
      return;
    }
    let newStart = value;
    if (newStart > maxStartSeconds) {
      newStart = maxStartSeconds;
    }
    if (newStart < 0) {
      newStart = 0;
    }
    if (Math.abs(newStart - startPosSeconds) < 0.01) {
      return;
    }

    setStartPosSeconds(newStart);

    player.howler?.seek(newStart);
  }, [duration, isFixed, maxStartSeconds, player.howler, startPosSeconds]);

  const handleSubmit = useCallback(async () => {
    if (maxStartSeconds <= 0) {
      return;
    }

    modal.close();
    await onSubmit(startPosSeconds / maxStartSeconds);
  }, [maxStartSeconds, modal, onSubmit, startPosSeconds]);

  const togglePlay = useCallback(() => {
    const howl = player.howler;
    if (!howl) {
      return;
    }
    try {
      if (state === "playing") {
        howl.pause();
      } else {
        howl.play();
      }
    } catch {
      // ignore
    }
  }, [player, state]);

  return (
    <ModalContent title="Review selected song" maxWidth="full">
      <PlaylistCard
        title={playlist.songs[0].name}
        subtitle={playlist.songs[0].artist}
        coverURL={playlist.songs[0].cover}
        hrefURL={playlist.songs[0].hrefURL}
        onPlayPause={togglePlay}
        audioState={state}
      />

      <div className="mb-4">
        <AudioSeekBar
          value={startPosSeconds}
          max={Math.max(duration, 0)}
          endSeconds={clampedEndSeconds}
          audioPlayTime={audioPlayTime}
          disabled={isFixed}
          onChange={handleSeekChange}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={duration <= 0}>
          Submit
        </Button>
      </div>
    </ModalContent>
  );
}
