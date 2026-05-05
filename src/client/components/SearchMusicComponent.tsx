import type { Playlist } from "../../types/MessageTypes";
import { useState } from "react";
import { albumRegex, artistRegex, songRegex } from "../../schemas/ValidationRegexes";
import { getPlaylistByURL, performSearch } from "../../shared/Utils";
import { Button } from "./Button";
import { PlaylistCard } from "./PlaylistCard";

/**
 * The current status of the search operation.
 */
type SearchStatus = "idle" | "loading" | "error" | "success";


function StatusIcon({ searchStatus }: { searchStatus: SearchStatus }) {
  switch (searchStatus) {
    case "loading":
      return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
    case "error":
      return <span className="material-symbols-outlined text-error">error</span>;
    case "success":
      return <span className="material-symbols-outlined text-success">check_circle</span>;
    case "idle":
      return undefined;
  }
}


/**
 * Props for the SearchMusicDialog component.
 */
export interface SearchMusicComponentProps {
  onlyAcceptSongs?: boolean;
  // should return true when the playlist add was sent successfully
  onPlaylistSelected: (playlist: Playlist) => Promise<boolean>;
  onSuccess?: () => void;
  /**
   * The start position for the audio preview. See {@link RoomConfigMessageSchema.audioStartPosition} (only 0-2 here!).
   */
  audioStartPos?: number;
}

/**
 * A modal dialog for searching Apple Music content by URL or search term.
 * Supports searching for songs, albums, and artists.
 * Can be restricted to only accept songs via the onlyAcceptSongs prop.
 */
export function SearchMusicComponent({
  onlyAcceptSongs = false,
  onPlaylistSelected,
  onSuccess,
  audioStartPos,
}: SearchMusicComponentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<Playlist[]>([]);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(() => new Set());

  const isValidURL = (onlyAcceptSongs
    ? songRegex.test(searchQuery)
    : artistRegex.test(searchQuery)
      || albumRegex.test(searchQuery)
      || songRegex.test(searchQuery)
  );

  const handleSearch = async () => {
    const query = searchQuery.trim();

    if (!query || searchStatus === "loading") {
      return;
    }

    if (onlyAcceptSongs ? songRegex.test(query) : (artistRegex.test(query) || albumRegex.test(query) || songRegex.test(query))) {
      setSearchStatus("loading");
      const playlist = await getPlaylistByURL(query);

      if (!playlist) {
        setSearchStatus("error");
        return;
      }

      if (await onPlaylistSelected(playlist)) {
        setSearchStatus("success");
        onSuccess?.();
      } else {
        setSearchStatus("error");
      }
      return;
    }

    setSearchStatus("loading");

    const items = await performSearch(query, onlyAcceptSongs);
    setSearchResults(items);

    setAddedIndices(new Set());
    setSearchStatus(items.length === 0 ? "error" : "idle");
  };

  const handleSelectResult = async (playlist: Playlist, index: number) => {
    const hrefURL = playlist.hrefURL;

    setSearchStatus("loading");

    if (playlist.songs.length === 0) {
      // assume playlist is Apple Music album/artist if songs entry is empty.
      const fetchedPlaylist = await getPlaylistByURL(hrefURL);

      if (!fetchedPlaylist) {
        setSearchStatus("error");
        return;
      }

      playlist = fetchedPlaylist;
    }

    setAddedIndices(prev => new Set([...prev, index]));

    if (await onPlaylistSelected(playlist)) {
      setSearchStatus("success");
      onSuccess?.();
    } else {
      setSearchStatus("error");
      setAddedIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col min-h-0 w-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <label htmlFor="music-search-input" className="sr-only">{onlyAcceptSongs ? "Search for a song" : "Search Apple Music"}</label>
          <input
            id="music-search-input"
            type="search"
            autoComplete="off"
            autoFocus={true}
            placeholder={onlyAcceptSongs ? "Search for a song…" : "Enter apple music URL or search term"}
            className={`w-full outline-0 focus:outline-0 border-b-2 pb-1 pr-10 ${
              searchQuery && searchQuery.startsWith("https://") && !isValidURL
                ? "focus:border-error"
                : "border-gray-500 focus:border-secondary"
            }`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (searchStatus === "error" || searchStatus === "success")
                setSearchStatus("idle");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // noinspection JSIgnoredPromiseFromCall
                handleSearch();
              }
            }}
          />
          <div className="absolute right-2 bottom-2 flex items-center">
            <StatusIcon searchStatus={searchStatus} />
          </div>
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={!searchQuery.trim() || searchStatus === "loading"}
          className="min-w-16"
          aria-label="Search"
        >
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4 overflow-y-auto flex-1 -mx-2 px-2">
          <ul className="space-y-2">
            {searchResults.map((playlist, idx) => (
              <PlaylistCard
                key={idx}
                title={playlist.name}
                subtitle={playlist.subtitle}
                coverURL={playlist.cover}
                hrefURL={playlist.hrefURL}
                previewURL={playlist.songs.length === 1 ? playlist.songs[0].audioURL : undefined}
                audioStartPos={audioStartPos}
              >
                <Button
                  onClick={() => handleSelectResult(playlist, idx)}
                  disabled={searchStatus === "loading" || addedIndices.has(idx)}
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
        <div className="mt-2">
          <p className="text-error">
            {searchResults.length === 0 && searchQuery.trim()
              ? "No results found."
              : "Failed to search. Please try again."}
          </p>
        </div>
      )}
    </div>
  );
}
