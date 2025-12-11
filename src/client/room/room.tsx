import { createRoot } from "react-dom/client";
import { useState, useCallback, createContext, useContext, useRef } from "react";
import { RoomController, useRoomController, useRoomControllerListener } from "./RoomController";
import type { ServerMessage } from "../../schemas/RoomServerMessageSchemas";

const RoomContext = createContext<RoomController | null>(null);

function useController() {
  const controller = useContext(RoomContext);
  if (!controller) throw new Error("useRoom must be used within RoomProvider");
  return controller;
}

function SearchBar() {
  const controller = useController();
  const [isHost, setIsHost] = useState(false);
  const [searchText, setSearchText] = useState("");

  const listener = useCallback((msg: ServerMessage) => {
    setIsHost(controller.isHost);
  }, [controller.isHost]);

  useRoomControllerListener(controller, listener);

  if (!isHost) return null;
 
  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
      <br/><br/>
      <input 
        placeholder="Enter apple music URL" 
        className="w-full outline-0 focus:outline-0 border-b-2 border-b-gray-400  focus:border-b-cyan-600 pb-1" 
        value={searchText} 
        onChange={e => {setSearchText(e.target.value)}} 
        onKeyDown={e => {if (e.key === "Enter") controller.performSearch(searchText);}}
      />
      <br/><br/>
    </>
  );
}

function Audio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const controller = useController();
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
      <audio ref={ref} />
      <div className="fixed bottom-4 left-4 flex items-center gap-2">
        <span className="material-icons text-gray-100">{volume > 0 ? (volume > 0.5 ? "volume_up" : "volume_down") : "volume_mute"}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </>
  );
}

function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const { getController, isReady } = useRoomController(roomID);

  if (!isReady) return null;

  const controller = getController();

  return (
    <RoomContext.Provider value={controller}>
      <Audio />
      <div className="max-w-3/4 mx-auto">
        <SearchBar />
      </div>
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
