import type { Playlist } from "../../../../types/MessageTypes";
import { useCallback, useEffect, useRef, useState } from "react";
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
    return modal.on("close", () => {
      player.howler?.pause();
    });
  }, [modal, player]);

  useRoomControllerMessageTypeListener(controller, "room_config");
  useRoomControllerMessageTypeListener(controller, "round_state");
  useRoomControllerMessageTypeListener(controller, "room_state");

  const isFixed = controller.config.audioStartPosition !== null;
  const guesstimeSeconds = controller.config.timePerQuestion;
  const audioPlaytimeSeconds = controller.config.timePerQuestion + QUESTION_PADDING_TICKS;

  const duration = player.howler?.duration() ?? 0;
  const [startPosSeconds, setStartPosSeconds] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const rafRef = useRef<number | null>(null);

  const maxStartSeconds = Math.max(0, duration - audioPlaytimeSeconds);
  const guesstimeEndSeconds = duration > 0
    ? Math.min(startPosSeconds + guesstimeSeconds, duration)
    : startPosSeconds + guesstimeSeconds;

  // Update start position when song changes
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setStartPosSeconds(0);
    // eslint-disable-next-line react/set-state-in-effect
    setPlaybackPosition(0);
  }, [playlist.songs]);

  // Keep playbackPosition in sync with Howler's actual playback position while playing.
  useEffect(() => {
    const howl = player.howler;
    if (state !== "playing" || !howl || duration <= 0) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const loop = () => {
      const pos = howl.seek();
      if (pos != null && !Number.isNaN(pos)) {
        setPlaybackPosition(pos);
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state, player.howler, duration]);

  useEffect(() => {
    if (controller.questionData.roundMsg?.gamePhase !== GamePhase.PICKING || controller.state !== "ingame") {
      modal.close();
    }
  }, [controller.questionData.roundMsg?.gamePhase, controller.state, modal]);

  const handleSelectionChange = useCallback((value: number) => {
    if (isFixed || duration <= 0) {
      return;
    }
    if (Math.abs(value - startPosSeconds) < 0.01) {
      return;
    }

    setStartPosSeconds(value);
    setPlaybackPosition(value);

    player.howler?.seek(value);
  }, [
    duration,
    isFixed,
    player.howler,
    startPosSeconds,
  ]);

  const handlePositionChange = useCallback((value: number) => {
    if (isFixed || duration <= 0) {
      return;
    }
    if (Math.abs(value - playbackPosition) < 0.01) {
      return;
    }

    setPlaybackPosition(value);

    player.howler?.seek(value);
  }, [
    duration,
    isFixed,
    playbackPosition,
    player.howler,
  ]);

  const handleSubmit = useCallback(async () => {
    modal.close();

    await onSubmit(maxStartSeconds === 0
      ? 0
      : startPosSeconds / maxStartSeconds);
  }, [
    maxStartSeconds,
    modal,
    onSubmit,
    startPosSeconds,
  ]);

  const togglePlay = useCallback(() => {
    const howl = player.howler;
    if (!howl) {
      return;
    }
    try {
      if (state === "playing") {
        howl.pause();
      } else {
        howl.seek(startPosSeconds);
        howl.play();
      }
    } catch {
      // ignore
    }
  }, [player.howler, startPosSeconds, state]);

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
          playbackPositionSeconds={playbackPosition}
          selectionStartSeconds={startPosSeconds}
          durationSeconds={duration}
          guesstimeEndSeconds={guesstimeEndSeconds}
          audioPlaytimeSeconds={audioPlaytimeSeconds}
          disabled={isFixed}
          onChange={handleSelectionChange}
          onSeek={handlePositionChange}
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
