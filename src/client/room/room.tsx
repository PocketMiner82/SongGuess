import { createRoot } from "react-dom/client";
import React, { useState, useCallback } from "react";
import { RoomContext, useControllerContext, useRoomController, useRoomControllerListener } from "./RoomController";
import type { ServerMessage } from "../../schemas/RoomMessageSchemas";
import { Lobby } from "./components/Lobby";
import {Ingame} from "./components/Ingame";
import {Results} from "./components/Results";


/**
 * Loading component displayed while the room controller is initializing.
 */
function Loading() {
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-2xl">Loading...</div>
    </div>
  );
}

/**
 * Countdown overlay component that displays a countdown number centered on screen.
 * Listens for countdown messages from the server and shows/hides accordingly.
 */
function Countdown() {
  const [countdown, setCountdown] = useState(0);
  const visible = countdown > 0;

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "countdown") return;
    setCountdown(msg.countdown);
  }, []);

  useRoomControllerListener(useControllerContext(), listener);

  return visible ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85">
      <div className="text-white text-9xl font-bold">{countdown}</div>
    </div>
  ) : null;
}

/**
 * Audio controller component that manages audio playback and volume.
 * Handles audio control messages from the server to play, pause, and load audio files.
 */
function Audio() {
  const audio = document.getElementById("audio") as HTMLAudioElement;
  const controller = useControllerContext();
  const [volume, setVolume] = useState(0.2);

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "audio_control") {
      return;
    }

    audio.volume = volume;

    // perform requested action
    switch (msg.action) {
      case "pause":
        audio.pause();
        return;
      case "play":
        audio.play().catch(() => {/* ignore play promise errors */});
        return;
      case "load":
        const currentAudioURL = msg.audioURL;
        // avoid resetting src if it is already correct
        if (audio.src !== currentAudioURL) audio.src = currentAudioURL;

        audio.load();
        break;
    }
  }, [audio, volume]);

  useRoomControllerListener(controller, listener);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
  };

  return (
    <>
      <div className="fixed bottom-4 left-4 flex items-center gap-2">
        <span className="material-icons">{volume > 0 ? (volume > 0.5 ? "volume_up" : "volume_down") : "volume_mute"}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-25"
        />
      </div>
    </>
  );
}

/**
 * Main application component for the game room.
 * Manages room initialization, routing between game states, and global room providers.
 */
function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const { getController, isReady } = useRoomController(roomID);

  if (!isReady) return <Loading />;

  const controller = getController();

  // if port is set, this is probably a dev environment: prevent accidental reloads
  if (!window.location.port) window.onbeforeunload = () => true;

  return (
    <RoomContext.Provider value={controller}>
      <Lobby />
      <Ingame />
      <Results />
      <Countdown />
      <Audio />
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
