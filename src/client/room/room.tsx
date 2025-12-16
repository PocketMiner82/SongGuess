import { createRoot } from "react-dom/client";
import { useState, useCallback, createContext, useContext, useRef, useMemo, memo } from "react";
import { RoomController, useIsHost, usePlayers, usePlaylists, useRoomController, useRoomControllerListener } from "./RoomController";
import type { PlayerState, GameState } from "../../schemas/RoomServerMessageSchemas";
import { COLORS } from "../../schemas/RoomSharedMessageSchemas";
import chroma from "chroma-js";
import type { ServerMessage } from "../../schemas/RoomMessageSchemas";
import { Button } from "../components/Button";
import { ErrorLabel } from "../components/ErrorLabel";

const RoomContext = createContext<RoomController | null>(null);

function useController() {
  const controller = useContext(RoomContext);
  if (!controller) throw new Error("useRoom must be used within RoomProvider");
  return controller;
}

function SearchBar() {
  const controller = useController();
  const isHost = useIsHost(controller);
  const [searchText, setSearchText] = useState("");
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const artistRegex = /^https?:\/\/music\.apple\.com\/[^/]*\/artist\/[^/]*\/(?<id>\d+)$/;
  const albumRegex = /^https?:\/\/music\.apple\.com\/[^/]*\/album\/[^/]*\/(?<id>\d+)$/;

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "confirmation" && msg.source === "host_update_playlists") {
      setSearchStatus(msg.error ? "error" : "success");
    }
  }, []);

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
    let status = searchStatus === "idle" && searchText && !isValidURL ? "error" : searchStatus;

    switch (status) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
      case "success":
        return <span className="material-icons text-green-400">check_circle</span>;
      case "error":
        return <span className="material-icons text-error">error</span>;
      case "idle":
        return null;
    }
  };

  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-primary hover:underline">Search Apple Music</a>
      <div className="relative mt-6 mb-12 flex gap-2">
        <input 
          placeholder="Enter apple music artist or album URL" 
          className="flex-1 outline-0 focus:outline-0 border-b-2 border-gray-500 focus:border-secondary pb-1 pr-10" 
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
        <Button
          onClick={() => handleSearch(searchText)}
          disabled={!isValidURL || searchStatus === "loading"}
          className=""
        >
          Set
        </Button>
      </div>
    </>
  );
}

function PlayerAvatar({size, playerState} : {size: number, playerState: PlayerState|null}) {
  return (
    <>
      {playerState ? (
        <div
          className="rounded-full flex items-center justify-center text-xl font-bold"
          style={{ 
            backgroundColor: playerState.color,
            color: getMaxContrastColor(playerState.color),
            width: size,
            height: size
          }}
        >
          {playerState.username.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="rounded-full bg-disabled-bg flex items-center justify-center"
          style={{ 
            width: size,
            height: size
          }}
        >
          <span className="text-disabled-text text-xl">+</span>
        </div>
      )}
    </>
  );
}

const PlayerListEntry = memo(function PlayerListEntry({
  player,
  username
}: {
  player: PlayerState|null;
  username: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(username);
  const controller = useController();

  const handleNameUpdate = () => {
    if (editedName.trim() && editedName !== username) {
      controller.updateUsername(editedName.trim());
    }
    setIsEditing(false);
  };

  return (
    <li className="flex items-center gap-4 p-3 bg-card-bg rounded-lg">
      <PlayerAvatar size={48} playerState={player} />
      {player ? (
        <div className="flex items-center gap-2">
          {isEditing ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameUpdate}
              onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
              autoFocus
              maxLength={16}
              className="text-lg bg-transparent border-b-2 border-gray-500 focus:outline-none focus:border-secondary"
            />
          ) : (
            <span 
              className={`text-lg font-medium ${player.username === username ? "cursor-pointer hover:underline" : ""}`}
              onClick={() => {
                if (player.username === username) {
                  setEditedName(username);
                  setIsEditing(true);
                }
              }}
            >
              {player.username + (player.username === username ? " (You)" : "")}
            </span>
          )}
        </div>
      ) : (
        <span className="text-lg text-disabled-text">Empty slot</span>
      )}
    </li>
  );
});

function PlayerList() {
  const controller = useController();
  const { players, username } = usePlayers(controller);
  
  const slots = useMemo(() => {
    const emptySlots = Math.max(0, COLORS.length - players.length);
    return [...players, ...Array(emptySlots).fill(null)];
  }, [players]);

  return (
    <div className="mb-12">
      <h3 className="text-xl font-bold mb-3">Players</h3>
      <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 max-h-[33vh] overflow-auto">
        {slots.map((player, idx) => (
          <PlayerListEntry
            key={player?.username || `empty-${idx}`}
            player={player}
            username={username}
          />
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

function PlaylistListEntry({index, title, subtitle, coverURL}: {index: string, title: string, subtitle?: string, coverURL?: string|null}) {
  return (
    <li key={index} className="flex items-center gap-6 p-3 bg-card-bg rounded-lg">
      {coverURL ? (
        <img src={coverURL} alt="Album Cover" className="w-25 h-25 lg:w-30 lg:h-30 2xl:w-40 2xl:h-40 rounded-xl object-cover" />
      ) : (
        <div className="w-25 h-25 lg:w-30 lg:h-30 2xl:w-40 2xl:h-40 rounded-xl bg-disabled-bg flex items-center justify-center">
          <span className="text-disabled-text text-4xl">?</span>
        </div>
      )}
      <div>
        <span className="text-xl font-medium wrap-break-word">{title}</span>
        {subtitle && <span className="text-sm text-disabled-text block">{subtitle}</span>}
      </div>
    </li>
  );
}

function PlaylistList() {
  const controller = useController();
  const playlists = usePlaylists(controller);

  return (
    <div className="mb-12">
      <h3 className="text-xl font-bold mb-3">Playlists</h3>
      <ul className="space-y-4 max-h-[33vh] overflow-auto">
        {playlists.length === 0 ? (
          <PlaylistListEntry index="no-playlist" title="No playlists added" />
        ) : (
          playlists.map((pl, idx) => (
            <PlaylistListEntry index={idx.toString()} title={pl.name} subtitle={pl.subtitle} coverURL={pl.cover} />
          ))
        )}
      </ul>
    </div>
  );
}

function StartGame() {
  const controller = useController();
  const isHost = useIsHost(controller);
  const playlists = usePlaylists(controller); // Reuse hook
  const [error, setError] = useState<string | null>(null);

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "confirmation" && msg.source === "start_game") {
      setError(msg.error ?? null);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  if (!isHost) return null;

  return (
    <div className="mb-12 mx-auto text-center">
      <ErrorLabel error={error} />

      <Button
        disabled={playlists.length === 0}
        onClick={() => controller.startGame()}
      >
        Start Game
      </Button>
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
      <PlayerList />
      <PlaylistList />
      <SearchBar />
      <StartGame />
    </div>
  );
}

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

  useRoomControllerListener(useController(), listener);

  return visible ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85">
      <div className="text-white text-9xl font-bold">{countdown}</div>
    </div>
  ) : null;
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
      <Countdown />
      <Audio />
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
