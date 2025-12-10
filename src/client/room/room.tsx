import { createRoot } from "react-dom/client";
import { useState, useCallback, createContext, useContext, useRef, useEffect } from "react";
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

  const listener = useCallback((msg: ServerMessage|null) => {
    const currentSong = controller.getCurrentSong();
    const audio = ref.current;
    if (!audio) return;

    if (currentSong && currentSong.audioURL) {
      if (audio.src !== currentSong.audioURL) audio.src = currentSong.audioURL;
      audio.load();
      audio.volume = 0.2;
      audio.play().catch(() => {/* ignore play promise errors */});
    } else {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }, [controller]);

  useRoomControllerListener(controller, listener);

  // initialize once from current controller state
  useEffect(() => {
    listener(null);
  }, [controller, listener]);

  return (
    <audio ref={ref} />
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
