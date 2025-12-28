import { createRoot } from "react-dom/client";
import React, { useState, useCallback, useRef } from "react";
import { RoomContext, useControllerContext, useRoomController, useRoomControllerListener } from "./RoomController";
import type { ServerMessage } from "../../schemas/RoomMessageSchemas";
import { Lobby } from "./components/Lobby";
import {Ingame} from "./components/Ingame";


function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-2xl">Loading...</div>
    </div>
  );
}

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

function Audio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const controller = useControllerContext();
  const [volume, setVolume] = useState(0.2);

  const listener = useCallback((msg: ServerMessage|null) => {
    const audio = ref.current;
    if (!audio) return;

    // TODO: check if needed
    if (!msg) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    } else if (msg.type !== "audio_control") {
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
  }, [volume]);

  useRoomControllerListener(controller, listener);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (ref.current) {
      ref.current.volume = newVolume;
    }
  };

  return (
    <>
      <audio ref={ref} preload="auto" />
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

function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const { getController, isReady } = useRoomController(roomID);

  if (!isReady) return <Loading />;

  const controller = getController();

  // TODO: prevent accidental navigation away
  //window.onbeforeunload = () => true;

  return (
    <RoomContext.Provider value={controller}>
      <Lobby />
      <Ingame />
      <Countdown />
      <Audio />
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
