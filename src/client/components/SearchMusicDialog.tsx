import { useState, useEffect, useCallback } from "react";
import { Button } from "./Button";
import { PlaylistCard } from "./PlaylistCard";
import { getPlaylistByURL, safeSearch, fixedCoverSize } from "../../Utils";
import { type Playlist } from "../../types/MessageTypes";
import { type ResultMusicTrack, type ResultAlbum, type ResultMusicArtist } from "itunes-store-api";
import { artistRegex, albumRegex, songRegex } from "../../schemas/ValidationRegexes";

/**
 * The current status of the search operation.
 */
type SearchStatus = "idle" | "loading" | "error";

/**
 * Represents a single search result item from Apple Music.
 */
type SearchResultItem = 
  | { type: "song"; data: ResultMusicTrack }
  | { type: "album"; data: ResultAlbum }
  | { type: "artist"; data: ResultMusicArtist };

/**
 * Props for the SearchMusicDialog component.
 */
interface SearchMusicDialogProps {
  /** Whether the dialog is currently open. */
  isOpen: boolean;
  /** Callback when the dialog should close. */
  onClose: () => void;
  /** Callback when a playlist is selected, receives the selected Playlist. */
  onPlaylistSelected: (playlist: Playlist) => void;
  /** When true, only songs are allowed (for guess-the-song game mode). */
  onlyAcceptSongs?: boolean;
}

/**
 * A modal dialog for searching Apple Music content by URL or search term.
 * Supports searching for songs, albums, and artists.
 * Can be restricted to only accept songs via the onlyAcceptSongs prop.
 */
export function SearchMusicDialog({
  isOpen,
  onClose,
  onPlaylistSelected,
  onlyAcceptSongs = false
}: SearchMusicDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  /**
   * Resets all state and closes the dialog.
   */
  const handleClose = useCallback(() => {
    setSearchQuery("");
    setSearchStatus("idle");
    setSearchResults([]);
    setAddedIndices(new Set());
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const isValidURL = (onlyAcceptSongs ? songRegex.test(searchQuery) : 
    artistRegex.test(searchQuery) || 
    albumRegex.test(searchQuery) || 
    songRegex.test(searchQuery)
  );

  /**
   * Handles the search action. If the query is a valid Apple Music URL,
   * directly fetches the playlist. Otherwise, searches Apple Music
   * for songs, albums, and artists matching the query.
   */
  const handleSearch = async () => {
    if (!searchQuery.trim() || searchStatus === "loading") return;

    const query = searchQuery.trim();

    if (onlyAcceptSongs ? songRegex.test(query) : (artistRegex.test(query) || albumRegex.test(query) || songRegex.test(query))) {
      setSearchStatus("loading");
      try {
        const playlist = await getPlaylistByURL(query);
        if (playlist) {
          onPlaylistSelected(playlist);
        } else {
          setSearchStatus("error");
        }
      } catch {
        setSearchStatus("error");
      }
      return;
    }

    setSearchStatus("loading");
    const items: SearchResultItem[] = [];

    try {
      const searchResults = await safeSearch(query, {
        media: "music",
        //@ts-ignore
        entity: "song,musicArtist,album",
        limit: 50
      });
      for (const result of searchResults) {
        if ("kind" in result && result.kind === "song" && result.wrapperType === "track") {
          items.push({ type: "song", data: result as ResultMusicTrack });
        } else if (result.wrapperType === "collection" && "collectionType" in result && (result as any).collectionType === "Album") {
          if (onlyAcceptSongs) continue;
          items.push({ type: "album", data: result as ResultAlbum });
        } else if (result.wrapperType === "artist") {
          if (onlyAcceptSongs) continue;
          items.push({ type: "artist", data: result as ResultMusicArtist });
        }
      }
    } catch {
      // ignore
    }

    setSearchResults(items);
    setAddedIndices(new Set());
    setSearchStatus(items.length === 0 ? "error" : "idle");
  };

  /**
   * Handles selecting a search result item. Fetches the playlist via URL
   * and calls onPlaylistSelected. Disables the button during loading
   * and permanently disables it if the selection was successful.
   */
  const handleSelectResult = async (item: SearchResultItem, index: number) => {
    const hrefURL = getResultHref(item);
    if (!hrefURL) return;

    if (!artistRegex.test(hrefURL) && !albumRegex.test(hrefURL) && !songRegex.test(hrefURL)) {
      return;
    }

    setAddedIndices(prev => new Set([...prev, index]));
    const playlist = await getPlaylistByURL(hrefURL);
    if (!playlist) {
      setAddedIndices(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    } else {
      onPlaylistSelected(playlist);
    }
  };

  /**
   * Returns the display title for a search result item.
   */
  const getResultTitle = (item: SearchResultItem): string => {
    switch (item.type) {
      case "song":
        return item.data.trackName;
      case "album":
        return item.data.collectionName;
      case "artist":
        return item.data.artistName;
    }
  };

  /**
   * Returns the display subtitle for a search result item (e.g., "Song by Artist").
   */
  const getResultSubtitle = (item: SearchResultItem): string | undefined => {
    switch (item.type) {
      case "song":
        return `Song by ${item.data.artistName}`;
      case "album":
        return `Album by ${item.data.artistName}`;
      case "artist":
        return undefined;
    }
  };

  /**
   * Returns the cover art URL for a search result item, or null for artists.
   */
  const getResultCover = (item: SearchResultItem): string | null => {
    switch (item.type) {
      case "song":
      case "album":
        return fixedCoverSize(item.data.artworkUrl100);
      case "artist":
        return null;
    }
  };

  /**
   * Returns the Apple Music URL for a search result item.
   */
  const getResultHref = (item: SearchResultItem): string | undefined => {
    switch (item.type) {
      case "song":
        return item.data.trackViewUrl;
      case "album":
        return item.data.collectionViewUrl;
      case "artist":
        return item.data.artistLinkUrl;
    }
  };

  /**
   * Returns the appropriate status icon based on the current search status.
   */
  const getStatusIcon = () => {
    switch (searchStatus) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
      case "error":
        return <span className="material-symbols-outlined text-error">error</span>;
      case "idle":
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-card-bg rounded-lg p-6 w-full mr-4 ml-4 lg:w-[60vw] lg:min-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-default">
            {onlyAcceptSongs ? "Search Songs" : "Search Apple Music"}
          </h2>
          <button
            onClick={handleClose}
            className="text-default hover:text-primary transition-colors cursor-pointer p-1"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <input
              placeholder={onlyAcceptSongs ? "Search for a song..." : "Enter apple music URL or search term"}
              className={`w-full outline-0 focus:outline-0 border-b-2 pb-1 pr-10 ${
                searchQuery && searchQuery.startsWith("https://") && !isValidURL
                  ? "focus:border-error" 
                  : "border-gray-500 focus:border-secondary"
              }`}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (searchStatus === "error") setSearchStatus("idle");
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
            />
            <div className="absolute right-2 bottom-2 flex items-center">
              {getStatusIcon()}
            </div>
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || searchStatus === "loading"}
            className="min-w-16"
          >
            <span className="material-symbols-outlined">search</span>
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 overflow-auto flex-1 -mx-2 px-2">
            <ul className="space-y-2">
              {searchResults.map((item, idx) => (
                <PlaylistCard
                  key={idx}
                  title={getResultTitle(item)}
                  subtitle={getResultSubtitle(item)}
                  coverURL={getResultCover(item)}
                  hrefURL={getResultHref(item)}
                >
                  <Button
                    onClick={() => handleSelectResult(item, idx)}
                    disabled={addedIndices.has(idx)}
                    className="min-w-20"
                  >
                    Select
                  </Button>
                </PlaylistCard>
              ))}
            </ul>
          </div>
        )}

        {searchStatus === "error" && (
          <p className="text-error mt-2">
            {searchResults.length === 0 && searchQuery.trim()
              ? "No results found."
              : "Failed to search. Please try again."}
          </p>
        )}
      </div>
    </div>
  );
}
