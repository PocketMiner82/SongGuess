import {PlaylistsFileSchema} from "./schemas/SharedSchemas";
import {
  type Entities,
  lookup,
  type Lookup,
  type Media,
  type Options,
  type PlainObject,
  type Response,
  type ResultMusicTrack,
  type Results
} from "itunes-store-api";
import z from "zod";
import React from "react";
import {DefaultPlaylist, type Playlist, type PlaylistsFile, type Song} from "./types/MessageTypes";
import {albumRegex, artistRegex, songRegex} from "./schemas/ValidationRegexes";


/**
 * Attempts to retrieve a {@link Playlist} by fetching songs from the iTunes Search API and (via proxy) music.apple.com.
 * @param url The Apple Music URL of the artist, song or album.
 */
export async function getPlaylistByURL(url: string): Promise<Playlist | null> {
  let targetLookupUrl: string = url;
  let type: "Artist"|"Song"|"Album" = "Song";

  let match;
  // test url using regexes to find what type of url it is
  if (songRegex.test(url)) {
    targetLookupUrl = url.replace(songRegex, (match, song, id) => {
      return match.replace(id, `0?i=${id}`)
          .replace(song, "album");
    });
  } else if (artistRegex.test(url)) {
    type = "Artist";
  } else if ((match = albumRegex.exec(url))) {
    // check if the track id is set, then it is also a song
    type = match.groups?.trackId ? "Song" : "Album";
  } else {
    return null;
  }

  const playlist: Playlist = await fetchPlaylistInfo(url);

  // server did not add tracks, we need to ask apple ourselves
  if (playlist.songs.length === 0) {
    let results: ResultMusicTrack[] = await safeLookup("url", targetLookupUrl, {
      entity: "song",
      limit: 50
    });

    if (results.length === 0) return null;

    // filter only music tracks and map to our internal format
    playlist.songs = results.filter(r => r.wrapperType === "track").map(r => ({
      name: r.trackName,
      audioURL: r.previewUrl,
      artist: r.artistName,
      hrefURL: r.trackViewUrl,
      cover: fixedCoverSize(r.artworkUrl100)
    } satisfies Song));
  }

  // add subtitle + show song count if playlist is not song type
  playlist.subtitle = type + (type !== "Song"
      ? ` | ${playlist.songs.length} song${playlist.songs.length !== 1 ? "s" : ""}` : "");

  return playlist;
}

/**
 * Replaces the cover of a {@link Song} with a larger version.
 * @param url The url to search and replace the dimensions in
 * @returns the replaced url or null if the provided param is not a string
 */
export function fixedCoverSize(url: string|undefined|null): string|null {
  return !url
      ? null
      : url.replace(/\/[^/]+x[^/]+bb\.([a-z]+)$/, "/486x486bb.$1");
}

/**
 * Fetches playlist information from the server.
 *
 * @param url The Apple Music URL of the playlist.
 * @returns A Promise resolving to the Playlist information.
 */
async function fetchPlaylistInfo(url: string): Promise<Playlist> {
  try {
    let page = await fetch("/parties/api/playlistInfo?url=" + encodeURIComponent(url));
    return await page.json();
  } catch {
    return DefaultPlaylist;
  }
}

/**
 * Returns the first {@link Song} from a given results list returned by the iTunes Search API.
 * @param results the list of {@link ResultMusicTrack} to find and convert the first song
 * @returns a song with replaced bigger cover
 */
export function getFirstSong(results: ResultMusicTrack[]): Song|null {
  // Find first musicTrack (not musicVideo)
  const track = results.find((result): result is ResultMusicTrack =>
      result.kind === "song" && result.wrapperType === "track"
  );

  if (!track) return null;

  return {
    name: track.trackName,
    audioURL: track.previewUrl,
    artist: track.artistName,
    hrefURL: track.trackViewUrl,
    cover: fixedCoverSize(track.artworkUrl100)
  };
}

/**
 * Fetches Apple Music API to convert an isrc to an iTunes ID.
 * @param isrc The ISRC to lookup.
 * @returns the iTunes ID or null if not found.
 */
export async function fetchSongByISRC(isrc: string): Promise<Song|null> {
  try {
    let page = await fetch("/parties/api/songByISRC?isrc=" + encodeURIComponent(isrc));
    return await page.json();
  } catch (e) {
    console.error("Error fetching from api.song.link:", e);
    return null;
  }
}

/**
 * Safely looks up an entry using the iTunes Store API. Also handles potential caching issues.
 * @see {@link lookup}
 * @returns Promise resolving to an array of results.
 */
export async function safeLookup<M extends Media, E extends Entities[M]>(
    type: Lookup,
    value: number,
    options?: Partial<Options<M, E>>
): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]>
export async function safeLookup<M extends Media, E extends Entities[M]>(
    type: "url",
    value: string,
    options?: Partial<Options<M, E>>
): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]>
export async function safeLookup<M extends Media, E extends Entities[M]>(
    type: Lookup | "url",
    value: number | string,
    options: Partial<Options<M, E>> = {}
): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]> {
  let results: (E extends undefined ? Results[Entities[M]] : Results[E])[];

  try {
    try {
      // @ts-ignore
      results = (await lookup(type, value, options)).results;
    } catch {
      // this hack fixes a weird caching problem on Apple's side, where an old (invalid) access-control-allow-origin header gets cached
      try {
        let newOptions = { ...options, magicnumber: Date.now() };
        // @ts-ignore
        results = (await lookup(type, value, newOptions)).results;
      } catch {
        results = [];
      }
    }
  } catch (e) {
    results = [];
  }

  return results;
}

/**
 * Safely searches using the iTunes Store API. Also handles potential caching issues.
 * @param term The search term.
 * @param options Optional search options.
 * @returns Promise resolving to an array of results.
 */
export async function safeSearch<M extends Media, E extends Entities[M]>(term: string, options: Partial<Options<M, E>> = {}): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]> {
  let results: (E extends undefined ? Results[Entities[M]] : Results[E])[];

  try {
    try {
      results = (await search(term, options)).results;
    } catch {
      // this hack fixes a weird caching problem on Apple's side, where an old (invalid) access-control-allow-origin header gets cached
      try {
        let newOptions = { ...options, magicnumber: Date.now() };
        // @ts-ignore
        results = (await search(term, newOptions)).results;
      } catch {
        results = [];
      }
    }
  } catch (e) {
    results = [];
  }

  return results;
}

const defaultOptions: Partial<Options> = {
  country: "de"
}

async function search<M extends Media, E extends Entities[M]>(
    search: string,
    options: Partial<Options<M, E>> = {}
): Promise<Response<M, E>> {
  const resolvedOptions = { ...defaultOptions, ...options }

  return await query<Response<M, E>>("search", {
    ...resolvedOptions,
    explicit: resolvedOptions.explicit ? "Yes" : "No",
    term: search
  })
}

const API = "https://itunes.apple.com"

/**
 * Query an endpoint from the iTunes Store API.
 *
 * @param endpoint - The API endpoint to query.
 * @param parameters - An object of URL parameters.
 */
async function query<T = PlainObject>(
    endpoint: string,
    parameters: Record<string, boolean | number | string>
): Promise<T> {
  // Map through entries and manually encode keys and values
  const queryString = Object.entries(parameters)
      .map(([key, value]) => {
        return `${encodeURIComponent(key).replace(/%20/g, "+")}=${encodeURIComponent(value).replace(/%20/g, "+")}`;
      })
      .join('&');

  try {
    const response = await fetch(`${API}/${endpoint}?${queryString}`);

    if (response.ok) {
      return await response.json();
    } else {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(response.statusText);
    }
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Downloads content as a file with the specified filename.
 * @param content The content to download
 * @param filename The filename to use
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads and parses a playlist file from an input file event.
 * @param event The file input change event
 * @returns Promise resolving to the parsed PlaylistsFile or null if failed
 */
export async function importPlaylistFile(event: React.ChangeEvent<HTMLInputElement>): Promise<PlaylistsFile | null> {
  const file = event.target.files?.[0];
  if (!file) return null;

  try {
    const content = await (file.text ? file.text() : new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    }));
    
    return JSON.parse(content);
  } catch (e) {
    console.error("Failed to read or parse playlist file:", e);
    return null;
  }
}

/**
 * Validates a playlists file against the schema.
 * @param data The data to validate
 * @returns The validated PlaylistsFile or null if invalid
 */
export function validatePlaylistsFile(data: any): PlaylistsFile | null {
  const result = PlaylistsFileSchema.safeParse(data);
  if (!result.success) {
    console.error("Invalid playlist JSON file:\n%s", z.prettifyError(result.error));
    return null;
  }
  return result.data;
}

/**
 * Refreshes playlists by fetching updated data for each hrefURL.
 * @param playlists The playlists to refresh
 * @param onProgress Optional progress callback
 * @returns Promise resolving to the refreshed playlists
 */
export async function refreshPlaylists(
  playlists: Playlist[], 
  onProgress?: (current: number, total: number, playlist: Playlist | null) => void
): Promise<Playlist[]> {
  const refreshedPlaylists: Playlist[] = [];
  
  for (let i = 0; i < playlists.length; i++) {
    const playlist = playlists[i];
    onProgress?.(i + 1, playlists.length, playlist);
    
    if (playlist.hrefURL) {
      try {
        const refreshedPlaylist = await getPlaylistByURL(playlist.hrefURL);
        if (refreshedPlaylist) {
          refreshedPlaylists.push(refreshedPlaylist);
        } else {
          // If refresh failed, keep the original playlist
          refreshedPlaylists.push(playlist);
        }
      } catch (error) {
        console.error(`Failed to refresh playlist ${playlist.name}:`, error);
        // Keep the original playlist if refresh failed
        refreshedPlaylists.push(playlist);
      }
    } else {
      // Keep playlists without hrefURL as-is
      refreshedPlaylists.push(playlist);
    }
  }
  
  onProgress?.(playlists.length, playlists.length, null);
  return refreshedPlaylists;
}