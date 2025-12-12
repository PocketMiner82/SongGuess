import { createRoot } from "react-dom/client";
import { useState, useCallback, createContext, useContext, useRef } from "react";
import { RoomController, useRoomController, useRoomControllerListener } from "./RoomController";
import type { ServerMessage, PlayerState, GameState } from "../../schemas/RoomServerMessageSchemas";
import { COLORS, type Playlist } from "../../schemas/RoomSharedMessageSchemas";
import chroma from "chroma-js";

const ITEM_BASE = "p-3 bg-gray-700 rounded-lg";
const PLAYER_ITEM_CLASS = `flex items-center gap-4 ${ITEM_BASE}`;
const PLAYLIST_ITEM_CLASS = `flex items-center gap-6 ${ITEM_BASE}`;
const AVATAR_CLASS = "w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold";

// new shared classes to remove duplication
const EMPTY_AVATAR_CLASS = "w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center";
const EMPTY_AVATAR_ICON = "text-gray-500 text-xl";
const COVER_IMG_CLASS = "w-24 h-24 rounded-xl object-cover";
const COVER_PLACEHOLDER_CLASS = "w-24 h-24 rounded-xl bg-gray-600 flex items-center justify-center";
const COVER_ICON_CLASS = "text-gray-500 text-2xl";

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
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const artistRegex = /^https?:\/\/music\.apple\.com\/[^/]*\/artist\/[^/]*\/(?<id>\d+)$/;
  const albumRegex = /^https?:\/\/music\.apple\.com\/[^/]*\/album\/[^/]*\/(?<id>\d+)$/;

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setIsHost(msg.isHost);
    } else if (msg.type === "server_update_playlists") {
      if (msg.playlists.length > 0 && searchText) {
        setSearchStatus(msg.error ? "error" : "success");
      }
    }
  }, [searchText]);

  useRoomControllerListener(controller, listener);

  if (!isHost) return null;

  const isValidURL = artistRegex.test(searchText) || albumRegex.test(searchText);

  const handleSearch = (text: string) => {
    if (isValidURL) {
      setSearchStatus("loading");
      controller.performSearch(text).then(success => {
        if (!success) {
          setSearchStatus("error");
        }
      }).catch(() => {
        setSearchStatus("error");
      });
    }
  };

  const getStatusIcon = () => {
    switch (searchStatus) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-400">progress_activity</span>;
      case "success":
        return <span className="material-icons text-green-400">check_circle</span>;
      case "error":
        return <span className="material-icons text-red-400">error</span>;
      case "idle":
        return <span className="material-icons text-red-400" style={searchText && !isValidURL ? undefined : {visibility: "hidden"}}>error</span>;
    }
  };

  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
      <div className="relative mt-6 mb-12 flex gap-2">
        <input 
          placeholder="Enter apple music artist or album URL" 
          className="flex-1 outline-0 focus:outline-0 border-b-2 border-b-gray-400 focus:border-b-cyan-600 pb-1 pr-10" 
          value={searchText} 
          onChange={e => {
            setSearchText(e.target.value);
            setSearchStatus("idle");
          }} 
          onKeyDown={e => {
            if (e.key === "Enter" && isValidURL && searchStatus !== "loading") {
              handleSearch(searchText);
            }
          }}
        />
        <div className="bottom-1 flex items-center">
          {getStatusIcon()}
        </div>
        <button
          onClick={() => handleSearch(searchText)}
          disabled={!isValidURL || searchStatus === "loading"}
          className="px-2 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          Set
        </button>
      </div>
    </>
  );
}

function PlayerList() {
  const controller = useController();
  const [players, setPlayers] = useState<PlayerState[]>([]);

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setPlayers(msg.players);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  const maxPlayers = COLORS.length;
  const emptySlots = Math.max(0, maxPlayers - players.length);
  const slots = [...players, ...Array(emptySlots).fill(null)];

  return (
    <div className="mb-12">
      <h3 className="text-2xl font-semibold text-gray-200 mb-3">Players</h3>
      <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 max-h-[33vh] overflow-auto">
        {slots.map((p, idx) => (
          <li key={idx} className={PLAYER_ITEM_CLASS}>
            {p ? (
              <>
                <div
                  className={AVATAR_CLASS}
                  style={{ 
                    backgroundColor: p.color ?? "#9ca3af",
                    color: getMaxContrastColor(p.color ?? "#9ca3af")
                  }}
                  aria-hidden
                >
                  {p.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-lg text-gray-100 font-medium wrap-break-word">{p.username}</span>
              </>
            ) : (
              <>
                <div className={EMPTY_AVATAR_CLASS}>
                  <span className={EMPTY_AVATAR_ICON}>+</span>
                </div>
                <span className="text-lg text-gray-500">Empty slot</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getMaxContrastColor(colorName: string): string {
  const color = chroma(colorName);
  const withBlack = chroma.contrast(color, "#000");
  const withWhite = chroma.contrast(color, "#fff");
  return withBlack > withWhite ? "#000" : "#fff";
}

function PlaylistList() {
  const controller = useController();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "server_update_playlists") {
      setPlaylists(msg.playlists);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  return (
    <div className="mb-12">
      <h3 className="text-2xl font-semibold text-gray-200 mb-3">Playlists</h3>
      <ul className="space-y-4 max-h-[33vh] overflow-auto">
        {playlists.length === 0 ? (
          <li key="empty" className={PLAYLIST_ITEM_CLASS}>
            <div className={COVER_PLACEHOLDER_CLASS}>
              <span className={COVER_ICON_CLASS}>?</span>
            </div>
            <span className="text-lg text-gray-500">No playlist selected</span>
          </li>
        ) : (
          playlists.map((pl, idx) => (
            <li key={idx} className={PLAYLIST_ITEM_CLASS}>
              {pl.cover ? (
                <img src={pl.cover} alt="Album Cover" className={COVER_IMG_CLASS} />
              ) : (
                <div className={COVER_PLACEHOLDER_CLASS}>
                  <svg viewBox="0 0 24 24" className="w-12 h-12 text-gray-400" fill="currentColor" aria-hidden>
                    <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v1h20v-1c0-3.3-6.7-5-10-5z"/>
                  </svg>
                </div>
              )}
              <span className="text-lg text-gray-100 font-medium wrap-break-word">{pl.name}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function StartGame() {
  const controller = useController();
  const [isHost, setIsHost] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setIsHost(msg.isHost);
      if (msg.error) {
        setError(msg.error);
      } else {
        setError(null);
      }
    } else if (msg.type === "server_update_playlists") {
      setPlaylists(msg.playlists);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  if (!isHost) return null;

  return (
    <div className="mb-12 mx-auto text-center">
      <div
        className="flex items-center justify-center mb-2 text-sm text-red-800 rounded-lg dark:text-red-400"
        style={error ? undefined : {visibility: "hidden"}}
        role="alert"
      >
        <span className="material-icons mr-1">error</span>
        <div>
          <span className="font-medium">{error}</span>
        </div>
      </div>

      <button
        disabled={playlists.length === 0}
        onClick={() => controller.startGame()}
        className="text-white bg-pink-600 rounded hover:bg-pink-700 disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer font-bold text-lg py-2 px-4 transition-colors"
      >
        Start Game
      </button>
    </div>
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

function Lobby() {
  const controller = useController();
  const [state, setState] = useState<GameState>("lobby");

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setState(msg.state);
    }
  }, []);
  useRoomControllerListener(controller, listener);

  if (state !== "lobby") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto">
      <SearchBar />
      <PlayerList />
      <PlaylistList />
      <StartGame />
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-2xl text-gray-200">Loading...</div>
    </div>
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
      <Audio />
      <Lobby />
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
