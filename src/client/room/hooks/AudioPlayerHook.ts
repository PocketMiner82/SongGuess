import type { RoomConfigMessageSchema } from "../../../schemas/SharedSchemas";
import { Howl } from "howler";
import { useEffect, useRef, useState } from "react";


export interface AudioPlayer {
  audioURL: string | undefined;
  state: "loading" | "playing" | "not_playing";
  howler: Howl | null;
  load: (src: string) => void;
  playWithPositionAndFade: (startPosition: (number | null), audioPlayTime: number, startOffset?: number, fadeDuration?: number) => void;
  playWithFade: (fadeDuration?: number) => void;
  pauseWithFade: (fadeDuration?: number) => void;
}

/**
 * An audio player based on Howler.
 * @param volume the volume to use. Can be updated (will not re-create howl instance).
 * @param muted whether to mute the volume. can also be updated.
 * @param url the url to initially load. omit if no url should be loaded.
 */
export function useAudioPlayer(volume: number, muted: boolean, url?: string): AudioPlayer {
  const [state, setState] = useState<"loading" | "playing" | "not_playing">("not_playing");
  const [audioURL, setAudioURL] = useState<string | undefined>(url);

  const createHowl = (src: string) => {
    return new Howl({
      src,
      format: "mp3",
      volume,
      mute: muted,
      preload: true,
      onplay: () => setState("playing"),
      onpause: () => setState("not_playing"),
      onend: () => setState("not_playing"),
      onstop: () => setState("not_playing"),
      onplayerror: () => setState("not_playing"),
    });
  };

  const howlerRef = useRef<Howl | null>(url ? createHowl(url) : null);

  // update muted when changed
  useEffect(() => {
    if (!howlerRef.current) {
      return;
    }
    const howler = howlerRef.current;

    howler.mute(muted);
  }, [muted]);

  // update volume when changed
  useEffect(() => {
    if (!howlerRef.current) {
      return;
    }
    const howler = howlerRef.current;

    howler.volume(volume);
  }, [volume]);

  useEffect(() => {
    // cleanup logic for when the component unmounts
    return () => {
      howlerRef.current?.stop();
    };
  }, []);

  /**
   * Load and fetches audio.
   * @param src The audio url to load.
   */
  const load = (src: string) => {
    if (audioURL !== src) {
      howlerRef.current = createHowl(src);
      setAudioURL(src);
      setState("loading");
    }
  };

  /**
   * Plays audio with fade in effect.
   * @param fadeDuration the fade-in duration (ms) to use.
   */
  const playWithFade = (fadeDuration: number = 1000) => {
    if (!howlerRef.current) {
      console.error("[Audio] Cannot play audio before loading.");
      return;
    }
    const howler = howlerRef.current;

    howler.once("play", () => {
      howler.volume(0);
      howler.fade(0, volume, fadeDuration);
    });
    howler.play();
  };

  /**
   * Plays audio from a given position
   * @param startPosition start position for the audio. See {@link RoomConfigMessageSchema.audioStartPosition}.
   * @param audioPlayTime the max time the audio should play, used to calculate actual start position time.
   * @param startOffset the offset to apply additionally to the start position time.
   * @param fadeDuration the fade-in duration (ms) to use.
   */
  const playWithPositionAndFade = (
    startPosition: number | null,
    audioPlayTime: number,
    startOffset: number = 0,
    fadeDuration: number = 1000,
  ) => {
    if (!howlerRef.current) {
      console.error("[Audio] Cannot play audio before loading.");
      return;
    }
    const howler = howlerRef.current;

    playWithFade(fadeDuration);

    howler.once("play", () => {
      const duration = howler.duration();

      switch (startPosition) {
        // null|0: start, nothing to do
        case 1: // Middle
          startOffset += Math.max(0, (duration - audioPlayTime) / 2);
          break;
        case 2: // End
          startOffset += Math.max(0, duration - audioPlayTime - 0.5);
          break;
      }

      howler.seek(startOffset);
    });
  };

  /**
   * Pauses the playback with fade out effect.
   * @param fadeDuration the fade-out duration (ms) to use.
   */
  const pauseWithFade = (fadeDuration: number = 1000) => {
    if (!howlerRef.current) {
      console.error("[Audio] Cannot pause audio before loading.");
      return;
    }
    const howler = howlerRef.current;

    howler.fade(howler.volume(), 0, fadeDuration);
    howler.once("fade", () => {
      howler.pause();
      howler.volume(volume);
    });
  };

  return {
    audioURL,
    state,
    howler: howlerRef.current,
    load,
    playWithPositionAndFade,
    playWithFade,
    pauseWithFade,
  };
}
