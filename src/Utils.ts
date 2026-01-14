import {
  albumRegex,
  artistRegex,
  type Playlist,
  type PlaylistsFile,
  type Song,
  songRegex,
  UnknownPlaylist,
  PlaylistsFileSchema
} from "./schemas/RoomSharedSchemas";
import {type Entities, lookup, search, type Media, type Options, type ResultMusicTrack, type Results} from "itunes-store-api";
import z from "zod";

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * * @template T - The type of elements in the array.
 * @param array - The array to be shuffled.
 * @returns The same array instance, now shuffled.
 *
 * @source https://stackoverflow.com/questions/48083353/i-want-to-know-how-to-shuffle-an-array-in-typescript
 * @author Posted by Sergii Rudenko, modified by community. See post 'Timeline' for change history, retrieved 2025-12-18
 * @license CC BY-SA 4.0
 */
export function shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

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
    let results: ResultMusicTrack[] = await lookupURL(targetLookupUrl, {
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
      cover: r.artworkUrl100.replace(/100x100(bb.[a-z]+)$/, "486x486$1")
    } satisfies Song));
  }

  // add subtitle + show song count if playlist is not song type
  playlist.subtitle = type + (type !== "Song"
      ? ` | ${playlist.songs.length} song${playlist.songs.length !== 1 ? "s" : ""}` : "");

  return playlist;
}

/**
 * Fetches playlist information from the server.
 *
 * @param url The Apple Music URL of the playlist.
 * @returns A Promise resolving to the Playlist information.
 */
async function fetchPlaylistInfo(url: string): Promise<Playlist> {
  try {
    let page = await fetch("/parties/main/playlistInfo?url=" + encodeURIComponent(url));
    return await page.json();
  } catch {
    return UnknownPlaylist;
  }
}

/**
 * Safely looks up a URL using the iTunes Store API. Also handles potential caching issues.
 * @param url The URL to look up.
 * @param options Optional lookup options.
 * @returns Promise resolving to an array of results.
 */
async function lookupURL<M extends Media, E extends Entities[M]>(url: string, options: Partial<Options<M, E>> = {}): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]> {
  let results: (E extends undefined ? Results[Entities[M]] : Results[E])[];

  try {
    try {
      results = (await lookup("url", url, options)).results;
    } catch {
      // this hack fixes a weird caching problem on Apple's side, where an old (invalid) access-control-allow-origin header gets cached
      try {
        let newOptions = { ...options, magicnumber: Date.now() };
        // @ts-ignore
        results = (await lookup("url", url, newOptions)).results;
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
export async function searchURL<M extends Media, E extends Entities[M]>(term: string, options: Partial<Options<M, E>> = {}): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]> {
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