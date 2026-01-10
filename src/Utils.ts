import {
  albumRegex,
  artistRegex,
  type Playlist,
  type Song,
  songRegex,
  UnknownPlaylist
} from "./schemas/RoomSharedSchemas";
import {type Entities, lookup, type Media, type Options, type ResultMusicTrack, type Results} from "itunes-store-api";

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