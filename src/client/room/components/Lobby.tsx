import { useState, useCallback, useMemo } from "react";
import {albumRegex, artistRegex, songRegex} from "../../../schemas/RoomSharedSchemas";
import { Button } from "../../components/Button";
import { ErrorLabel } from "../../components/ErrorLabel";
import { useIsHost, useRoomControllerListener, usePlayers, usePlaylists, useControllerContext, useGameState } from "../RoomController";
import {PlayerCard} from "./PlayerCard";
import {COLORS} from "../../../server/ServerConstants";


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
      <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-4 gap-4 max-h-[33vh] overflow-auto">
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
 * @param hrefURL URL to open in new tab when clicking the title.
 */
function PlaylistListEntry({index, title, subtitle, coverURL, hrefURL}: {index: number, title: string, subtitle?: string, coverURL?: string|null, hrefURL?: string}) {
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
        <a
            target="_blank"
            rel="noopener noreferrer" href={hrefURL}
            className={`text-xl font-medium wrap-break-word ${hrefURL && "hover:underline hover:cursor-pointer"}`}>
          {title}
        </a>
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
 * Button component that downloads the current playlists as a JSON file.
 */
function DownloadPlaylists() {
  const controller = useControllerContext();
  const playlists = usePlaylists(controller);

  const handleDownload = () => {
    const content = controller.generatePlaylistsFile();
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SongGuessPlaylists.sgjson";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={playlists.length === 0}
      className="items-center flex justify-center"
    >
      <span className="material-symbols-outlined">download</span>
    </Button>
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
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold">Playlists</h3>
        <DownloadPlaylists />
      </div>
      <ul className="space-y-4 overflow-auto flex-1">
        {playlists.length === 0 ? (
          <PlaylistListEntry index={-1} title="No playlists added" />
        ) : (
          playlists.map((pl, idx) => (
            <PlaylistListEntry key={idx} index={idx} title={pl.name} subtitle={pl.subtitle} coverURL={pl.cover} hrefURL={pl.hrefURL} />
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
 * Button component that imports playlists from a JSON file.
 */
function ImportPlaylists({ setError }: { setError: (error: string | null) => void }) {
  const controller = useControllerContext();

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = controller.importPlaylistsFromFile(content);
      if (!success) {
        setError("Failed to import playlists. Please check the file format.");
        setTimeout(() => setError(null), 3000);
      }
      // Reset file input
      event.target.value = "";
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setTimeout(() => setError(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <input
        type="file"
        accept=".sgjson"
        onChange={handleImport}
        className="hidden"
        id="playlist-import"
      />
      <Button
        onClick={() => document.getElementById("playlist-import")?.click()}
        className="min-w-full"
      >
        <span className="material-symbols-outlined mr-2">upload</span>
        Import
      </Button>
    </div>
  );
}

/**
 * Button component that clears all playlists after user confirmation.
 */
function ClearPlaylists() {
  const controller = useControllerContext();
  const playlists = usePlaylists(controller);

  const handleClearPlaylists = () => {
    const isConfirmed = window.confirm("Are you sure you want to clear all playlists?");
    if (isConfirmed) {
      controller.removePlaylist(null);
    }
  };

  return (
    <Button
      onClick={handleClearPlaylists}
      disabled={playlists.length === 0}
      className="items-center flex justify-center"
    >
      <span className="material-symbols-outlined mr-2">delete</span>
      Clear Playlists
    </Button>
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
          <ClearPlaylists />
          <ImportPlaylists setError={setError} />
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
    <div className="lg:max-w-3/4 mx-auto p-4 min-h-full flex flex-col">
      <div className="mb-12 shrink-0">
        <PlayerList />
      </div>
      <div className={`grid gap-4 grid-cols-1 flex-1 ${isHost ? "lg:grid-cols-2" : ""}`}>
        <div className="lg:order-last">
          {isHost && <Settings />}
        </div>

        <div className="lg:order-first min-h-0">
          <PlaylistList />
        </div>
      </div>
    </div>
  );
}
