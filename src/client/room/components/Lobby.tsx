import React, {useState, useCallback, useMemo, type ReactNode} from "react";
import { Button } from "../../components/Button";
import {useRoomControllerListener, useControllerContext, useRoomControllerMessageTypeListener} from "../RoomController";
import {PlayerCard} from "./PlayerCard";
import {COLORS} from "../../../ConfigConstants";
import {PlaylistCard} from "../../components/PlaylistCard";
import { downloadFile, importPlaylistFile, validatePlaylistsFile } from "../../../Utils";
import {albumRegex, artistRegex, songRegex} from "../../../schemas/ValidationRegexes";


/**
 * Displays all players in the room as a grid. Shows empty slots
 * if there are available colors remaining.
 */
function PlayerList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");
  
  const slots = useMemo(() => {
    const emptySlots = Math.max(0, COLORS.length - controller.players.length);
    return [...controller.players, ...Array(emptySlots).fill(null)];
  }, [controller.players]);

  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-3">Players</h3>
      <ul className="grid grid-cols-1 lg:max-h-none lg:grid-cols-2 2xl:grid-cols-4 gap-4 max-h-[33vh] overflow-auto">
        {slots.map((player, idx) => (
          <PlayerCard
            key={player?.username || `empty-${idx}`}
            player={player}>
            {controller.isHost && player?.username && player.username !== controller.username ? (
                <Button
                    onClick={() => {
                      const isConfirmed = window.confirm(
                          `Do you really want to transfer host to '${player.username}'?`
                      );
                      if (!isConfirmed) return;

                      controller.transferHost(player.username);
                    }}
                    title="Transfer Host">
                  <span className="material-symbols-outlined text-2xl">crown</span>
                </Button>
            ) : undefined}
          </PlayerCard>
        ))}
      </ul>
    </div>
  );
}

/**
 * Button component that downloads the current playlists as a JSON file.
 */
function DownloadPlaylists() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  const handleDownload = () => {
    const content = controller.generatePlaylistsFile();
    downloadFile(content, "SongGuessPlaylists.sgjson");
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={controller.playlists.length === 0}
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
function PlaylistsList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "update_playlists");
  useRoomControllerMessageTypeListener(controller, "room_config");

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-bold">Playlists - {
          `${controller.filteredSongsCount} song${controller.filteredSongsCount !== 1 ? "s" : ""} ${controller.config.advancedSongFiltering ? " (filtered)" : ""}`
        }</h3>
        <DownloadPlaylists />
      </div>
      <ul className="space-y-4 overflow-auto flex-1">
        {controller.playlists.length === 0 ? (
          <PlaylistCard index={-1} title="No playlists added yet." />
        ) : (
            controller.playlists.map((pl, idx) => (
            <PlaylistCard
                key={idx}
                index={idx}
                title={pl.name}
                subtitle={pl.subtitle}
                coverURL={pl.cover}
                hrefURL={pl.hrefURL}
                onDeleteClick={controller.isHost ? () => controller.removePlaylist(idx) : undefined}/>
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
  const [searchStatus, setSearchStatus] = useState<"idle" | "loading">("idle");

  useRoomControllerListener(controller, useCallback(msg => {
    if (msg && msg.type === "confirmation" && msg.sourceMessage.type === "add_playlists") {
      setSearchStatus("idle");
    }
    return false;
  }, []));

  const isValidURL = artistRegex.test(playlistURL) || albumRegex.test(playlistURL) || songRegex.test(playlistURL);

  const handleAdd = (text: string) => {
    if (isValidURL) {
      setSearchStatus("loading");
      controller.tryAddPlaylists(text).then(success => {
        if (!success) {
          setSearchStatus("idle");
        }
      }).catch(() => {
        setSearchStatus("idle");
      });
    }
  };

  const getStatusIcon = () => {
    switch (searchStatus) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
      case "idle":
        return null;
    }
  };

  return (
    <div>
      <div className="relative flex gap-2 mb-1">
        <input
            placeholder="Enter apple music artist or album URL"
            className={`flex-1 outline-0 focus:outline-0 border-b-2 pb-1 pr-10 ${
              playlistURL && !isValidURL 
                ? "focus:border-error" 
                : "border-gray-500 focus:border-secondary"
            }`}
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
      <a target="_blank" rel="noopener noreferrer"
         href="https://music.apple.com/"
         className="text-primary hover:underline">
        Search Apple Music
      </a>
    </div>
  );
}

/**
 * Button component that imports playlists from a JSON file.
 */
function ImportPlaylists() {
  const controller = useControllerContext();

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const data = await importPlaylistFile(event);
      if (!data) {
        if ((window as any).showToastError) {
          (window as any).showToastError("Failed to read file.");
        }
        return;
      }

      const playlistsFile = validatePlaylistsFile(data);
      if (!playlistsFile) {
        if ((window as any).showToastError) {
          (window as any).showToastError("Failed to import playlists. Please check the file format.");
        }
        return;
      }

      controller.importPlaylistsFromFile(playlistsFile);
    } catch (error) {
      if ((window as any).showToastError) {
        (window as any).showToastError("Failed to read file.");
      }
    }
    
    // Reset file input
    event.target.value = "";
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
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  const handleClearPlaylists = () => {
    const isConfirmed = window.confirm("Are you sure you want to clear all playlists?");
    if (isConfirmed) {
      controller.removePlaylist(null);
    }
  };

  return (
    <Button
      onClick={handleClearPlaylists}
      disabled={controller.playlists.length === 0}
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
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  return (
    <Button
      disabled={controller.playlists.length === 0}
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
      if ((window as any).showToastError) {
        (window as any).showToastError("Failed to copy link.");
      }
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

/**
 * Toggle switch component for advanced song filtering setting.
 * Features left-aligned label and right-aligned toggle switch.
 */
function SettingsToggle({ value, onToggle, children }: { value: boolean; onToggle: (value: boolean) => void; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>
        {children}
      </span>
      <button
        onClick={() => onToggle(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-secondary' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Number input component for settings with validation.
 * Features left-aligned label and right-aligned number input.
 */
function SettingsNumberInput({ value, onChange, min, max, children }: { 
  value: number; 
  onChange: (value: number) => void; 
  min: number; 
  max: number; 
  children: ReactNode 
}) {
  const [inputValue, setInputValue] = useState(value.toString());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const numValue = parseInt(newValue, 10);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = parseInt(inputValue, 10);
    if (isNaN(numValue) || numValue < min || numValue > max) {
      setInputValue(value.toString());
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span>
        {children}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-11 px-2 text-center border-b-2 border-gray-500 focus:border-secondary outline-0 focus:outline-0"
      />
    </div>
  );
}

/**
 * Dropdown select component for settings with predefined options.
 * Features left-aligned label and right-aligned dropdown.
 */
function SettingsDropdown({ value, onChange, options, children }: { 
  value: number; 
  onChange: (value: number) => void; 
  options: { value: number; label: string }[]; 
  children: ReactNode 
}) {
  return (
    <div className="flex items-center justify-between">
      <span>
        {children}
      </span>
      <select
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        className="px-2 py-1 border-b-2 border-gray-500 focus:border-secondary outline-0 focus:outline-0 bg-transparent"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Settings() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_config");

  return (
    <div>
      <h3 className="text-xl font-bold mb-3">Settings</h3>
      <div className="grid gap-4">
        <AddPlaylistInput />

        <div className="grid grid-cols-2 gap-4">
          <ClearPlaylists />
          <ImportPlaylists />
        </div>

        <div className="border-t border-disabled-bg my-1"></div>

        <SettingsToggle value={controller.config.advancedSongFiltering}
          onToggle={v => {
            controller.config.advancedSongFiltering = v;
            controller.sendConfig();
          }}
        >
          Perform advanced song filtering
        </SettingsToggle>

        <SettingsToggle value={controller.config.endWhenAnswered}
          onToggle={v => {
            controller.config.endWhenAnswered = v;
            controller.sendConfig();
          }}
        >
          End round when all players answered
        </SettingsToggle>

        <SettingsToggle value={controller.config.distractionsPreferSameArtist}
                        onToggle={v => {
                          controller.config.distractionsPreferSameArtist = v;
                          controller.sendConfig();
                        }}
        >
          Distractions: Prefer songs by same artist
        </SettingsToggle>

        <SettingsNumberInput 
          value={controller.config.questionsCount}
          onChange={v => {
            controller.config.questionsCount = v;
            controller.sendConfig();
          }}
          min={1}
          max={30}
        >
          Questions per round (1-30)
        </SettingsNumberInput>

        <SettingsNumberInput
            value={controller.config.timePerQuestion}
            onChange={v => {
              controller.config.timePerQuestion = v;
              controller.sendConfig();
            }}
            min={5}
            max={25}
        >
          Time per question (5-25s)
        </SettingsNumberInput>

        <SettingsDropdown
          value={controller.config.audioStartPosition}
          onChange={v => {
            controller.config.audioStartPosition = v;
            controller.sendConfig();
          }}
          options={[
            { value: 0, label: "Start of audio" },
            { value: 1, label: "Close to middle" },
            { value: 2, label: "Close to end" },
            { value: 3, label: "Randomize above" }
          ]}
        >
          Audio start position
        </SettingsDropdown>

        <div className="border-t border-disabled-bg my-1"></div>

        <div className="grid grid-cols-2 gap-4">
          <CopyLink />
          <StartGame />
        </div>
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
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  if (controller.state !== "lobby") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto p-4 min-h-full flex flex-col">
      <PlayerList />
      <div className={`grid gap-4 grid-cols-1 flex-1 ${controller.isHost ? "lg:grid-cols-2" : ""}`}>
        <div className="lg:order-last">
          {controller.isHost && <Settings />}
        </div>

        <div className="lg:order-first min-h-0">
          <PlaylistsList />
        </div>
      </div>
    </div>
  );
}
