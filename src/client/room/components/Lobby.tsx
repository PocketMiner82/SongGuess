import { useState, useCallback, useMemo } from "react";
import {albumRegex, artistRegex, COLORS, songRegex} from "../../../schemas/RoomSharedMessageSchemas";
import { Button } from "../../components/Button";
import { ErrorLabel } from "../../components/ErrorLabel";
import { useIsHost, useRoomControllerListener, usePlayers, usePlaylists, useControllerContext, useGameState } from "../RoomController";
import {PlayerCard} from "./PlayerCard";


/**
 * Displays all players in the room as a grid. Shows empty slots
 * if there are available colors remaining.
 */
function PlayerList() {
  const controller = useControllerContext();
  const { players, username } = usePlayers(controller);
  
  const slots = useMemo(() => {
    const emptySlots = Math.max(0, COLORS.length - players.length);
    return [...players, ...Array(emptySlots).fill(null)];
  }, [players]);

  return (
    <div className="mb-12">
      <h3 className="text-xl font-bold mb-3">Players</h3>
      <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 max-h-[33vh] lg:max-h-none overflow-auto">
        {slots.map((player, idx) => (
          <PlayerCard
            key={player?.username || `empty-${idx}`}
            player={player}
            username={username}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * Displays a single playlist entry with cover art, title and subtitle.
 * Shows a delete button for hosts.
 * 
 * @param index The playlist's position in the list
 * @param title The primary display name
 * @param subtitle Optional secondary text
 * @param coverURL URL for the cover image or null
 */
function PlaylistListEntry({index, title, subtitle, coverURL}: {index: number, title: string, subtitle?: string, coverURL?: string|null}) {
  const controller = useControllerContext();
  const isHost = useIsHost(controller);

  return (
    <li key={index} className="flex items-center gap-6 p-3 bg-card-bg rounded-lg">
      {coverURL ? (
        <img src={coverURL} alt="Album Cover" className="w-25 h-25 lg:w-30 lg:h-30 2xl:w-40 2xl:h-40 rounded-xl object-cover" />
      ) : (
        <div className="min-w-25 min-h-25 lg:min-w-30 lg:min-h-30 2xl:min-w-40 2xl:min-h-40 rounded-xl bg-disabled-bg flex items-center justify-center">
          <span className="text-disabled-text text-4xl">?</span>
        </div>
      )}
      <div className="w-full">
        <div className="text-xl font-medium wrap-break-word">{title}</div>
        {subtitle && <div className="text-sm text-disabled-text block">{subtitle}</div>}
      </div>
      {isHost && index >= 0 ?
        <Button
          onClick={() => controller.removePlaylist(index)}
          className="items-center flex justify-center"
        >
          <span className="material-symbols-outlined">delete</span>
        </Button>
      : null}
    </li>
  );
}

/**
 * Lists all added playlists in a vertical stack. Shows a placeholder
 * message when no playlists are available.
 */
function PlaylistList() {
  const controller = useControllerContext();
  const playlists = usePlaylists(controller);

  return (
    <div>
      <h3 className="text-xl font-bold mb-3">Playlists</h3>
      <ul className="space-y-4 overflow-auto">
        {playlists.length === 0 ? (
          <PlaylistListEntry index={-1} title="No playlists added" />
        ) : (
          playlists.map((pl, idx) => (
            <PlaylistListEntry key={idx} index={idx} title={pl.name} subtitle={pl.subtitle} coverURL={pl.cover} />
          ))
        )}
      </ul>
    </div>
  );
}

/**
 * Input component for hosts to add Apple Music playlists by URL.
 * Handles validation and loading states.
 */
function AddPlaylistInput() {
  const controller = useControllerContext();
  const [playlistURL, setPlaylistURL] = useState("");
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useRoomControllerListener(controller, useCallback(msg => {
    if (msg && msg.type === "confirmation" && msg.sourceMessage.type === "add_playlist") {
      setSearchStatus(msg.error ? "error" : "success");
    }
  }, []));

  const isValidURL = artistRegex.test(playlistURL) || albumRegex.test(playlistURL) || songRegex.test(playlistURL);

  const handleAdd = (text: string) => {
    if (isValidURL) {
      setSearchStatus("loading");
      controller.tryAddPlaylists(text).then(success => {
        if (!success) {
          setSearchStatus("error");
        }
      }).catch(() => {
        setSearchStatus("error");
      });
    }
  };

  const getStatusIcon = () => {
    let status = searchStatus === "idle" && playlistURL && !isValidURL ? "error" : searchStatus;

    switch (status) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
      case "success":
        return <span className="material-icons text-success">check_circle</span>;
      case "error":
        return <span className="material-icons text-error">error</span>;
      case "idle":
        return null;
    }
  };

  return (
    <div>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-primary hover:underline">Search Apple Music</a>
      <div className="relative mt-6 flex gap-2">
        <input
            placeholder="Enter apple music artist or album URL"
            className="flex-1 outline-0 focus:outline-0 border-b-2 border-gray-500 focus:border-secondary pb-1 pr-10"
            value={playlistURL}
            onChange={e => {
              setPlaylistURL(e.target.value);
              setSearchStatus("idle");
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && isValidURL && searchStatus !== "loading") {
                handleAdd(playlistURL);
              }
            }}
        />
        <div className="bottom-1 flex items-center">
          {getStatusIcon()}
        </div>
        <Button
            onClick={() => handleAdd(playlistURL)}
            disabled={!isValidURL || searchStatus === "loading"}
            className=""
        >
          Add
        </Button>
      </div>
    </div>
  );
}

/**
 * Host-only component to start the game. Shows validation errors
 * and handles the start game confirmation from the server.
 */
function StartGame() {
  const controller = useControllerContext();
  const playlists = usePlaylists(controller);

  return (
    <Button
      disabled={playlists.length === 0}
      onClick={() => controller.startGame()}
    >
      Start Game
    </Button>
  );
}

/**
 * Button component that copies the current page URL to clipboard.
 * Shows feedback when the link is successfully copied.
 */
function CopyLink() {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <Button
      onClick={handleCopyLink}
    >
      <span className="material-symbols-outlined mr-2">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied!" : "Copy Link"}
    </Button>
  );
}

function Settings() {
  const controller = useControllerContext();
  const [error, setError] = useState<string | null>(null);

  useRoomControllerListener(controller, useCallback(msg => {
    if (msg && msg.type === "confirmation" && msg.sourceMessage.type === "start_game") {
      setError(msg.error ?? null);
    }
  }, []));

  return (
    <div>
      <h3 className="text-xl font-bold mb-3">Settings</h3>
      <div className="grid gap-4">
        <AddPlaylistInput />
        <div className="grid grid-cols-2 gap-4">
          <CopyLink />
          <StartGame />
        </div>
        <ErrorLabel error={error} />
      </div>
    </div>
  );
}

/**
 * Main lobby component that only renders when game state is 'lobby'.
 * Organizes player list, playlist management and game start controls.
 */
export function Lobby() {
  const controller = useControllerContext();
  const isHost = useIsHost(controller);
  const state = useGameState(controller);

  if (state !== "lobby") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto p-4 h-screen">
      <PlayerList />
      <div className={`grid gap-4 grid-cols-1 ${isHost ? "lg:grid-cols-2" : ""}`}>
        <div className="lg:order-last">
          {isHost && <Settings />}
        </div>

        <div className="lg:order-first">
          <PlaylistList />
        </div>
      </div>
    </div>
  );
}
