import type { AudioPlayer } from "./AudioPlayerHook";
import { createContext, use } from "react";


export interface AudioPlayerContextValue {
  player: AudioPlayer;
  state: AudioPlayer["state"];
}

/**
 * Context carrying the live {@link AudioPlayer} instance and its reactive
 * playback state. Provided at the room root so any component — including
 * modals rendered through a portal — can read the same player and stay in
 * sync with its state without subscribing to Howler events themselves.
 */
export const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

/**
 * Reads the audio player and its reactive state from context.
 * Identical behaviour to calling `useAudioPlayer` in the consuming component,
 * except all consumers share the same player instance.
 * @throws Error if used outside an `AudioPlayerProvider`.
 */
export function useAudioPlayerContext(): AudioPlayerContextValue {
  const ctx = use(AudioPlayerContext);
  if (!ctx) {
    throw new Error("useAudioPlayerContext must be used within an AudioPlayerProvider");
  }
  return ctx;
}
