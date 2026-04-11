import React, { useState } from "react";
import { Button } from "../components/Button";
import { PlaylistCard } from "../components/PlaylistCard";
import { safeSearch, fixedCoverSize } from "../../Utils";
import { type ResultMusicTrack, type ResultAlbum, type ResultMusicArtist } from "itunes-store-api";
import { artistRegex, albumRegex, songRegex } from "../../schemas/ValidationRegexes";
import { ModalContent } from "./ModalContent";

/**
 * The current status of the search operation.
 */
type SearchStatus = "idle" | "loading" | "error" | "success";

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
  onlyAcceptSongs?: boolean;
  // should return true when the playlist add was sent successfully
  onPlaylistSelected: (url: string) => Promise<boolean>;
}

/**
 * A modal dialog for searching Apple Music content by URL or search term.
 * Supports searching for songs, albums, and artists.
 * Can be restricted to only accept songs via the onlyAcceptSongs prop.
 */
export function SearchMusicDialog({
  onlyAcceptSongs = false,
  onPlaylistSelected
}: SearchMusicDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set());

  const isValidURL = (onlyAcceptSongs ? songRegex.test(searchQuery) : 
    artistRegex.test(searchQuery) || 
    albumRegex.test(searchQuery) || 
    songRegex.test(searchQuery)
  );

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchStatus === "loading") return;

    const query = searchQuery.trim();

    if (onlyAcceptSongs ? songRegex.test(query) : (artistRegex.test(query) || albumRegex.test(query) || songRegex.test(query))) {
      setSearchStatus("loading");
      try {
        onPlaylistSelected(query).then(successful => {
          if (successful) {
            setSearchStatus("success");
          } else {
            setSearchStatus("error");
          }
        });
      } catch {
        setSearchStatus("error");
      }
      return;
    }

    setSearchStatus("loading");
    const items: SearchResultItem[] = [];

    try {
      const results = await safeSearch(query, {
        media: "music",
        //@ts-ignore
        entity: "song,musicArtist,album",
        limit: 50
      });
      for (const result of results) {
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

  const handleSelectResult = async (item: SearchResultItem, index: number) => {
    const hrefURL = getResultHref(item);
    if (!hrefURL) {
      setSearchStatus("error");
      return;
    }

    if (!artistRegex.test(hrefURL) && !albumRegex.test(hrefURL) && !songRegex.test(hrefURL)) {
      setSearchStatus("error");
      return;
    }

    setSearchStatus("loading");

    setAddedIndices(prev => new Set([...prev, index]));

    onPlaylistSelected(hrefURL).then(successful => {
      if (successful) {
        setSearchStatus("success");
      } else {
        setSearchStatus("error");
        setAddedIndices(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    });
  };

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

  const getResultCover = (item: SearchResultItem): string | null => {
    switch (item.type) {
      case "song":
      case "album":
        return fixedCoverSize(item.data.artworkUrl100);
      case "artist":
        return null;
    }
  };

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

  const getStatusIcon = () => {
    switch (searchStatus) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>;
      case "error":
        return <span className="material-symbols-outlined text-error">error</span>;
      case "success":
        return <span className="material-symbols-outlined text-success">check_circle</span>;
      case "idle":
        return null;
    }
  };

  return (
      <ModalContent title={onlyAcceptSongs ? "Search Songs" : "Search Apple Music"} maxWidth="full">
        <div className="flex flex-col max-h-[70vh] min-h-0">
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
                    if (searchStatus === "error" || searchStatus === "success") setSearchStatus("idle");
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      // noinspection JSIgnoredPromiseFromCall
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
              <div className="mt-4 overflow-y-auto flex-1 -mx-2 px-2">
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
      </ModalContent>
  );
}