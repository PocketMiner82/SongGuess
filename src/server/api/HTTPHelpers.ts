import type { RoomGetResponse } from "../../types/APIResponseTypes";
import { env } from "cloudflare:workers";
import { soundCloudSongRegex } from "../../schemas/ValidationRegexes";

/**
 * Fetches room information from the specified URL.
 *
 * @param url The URL to fetch room information from.
 * @returns A Promise resolving to the room information, or null if the request fails or validation fails.
 */
export async function fetchGetRoom(url: URL | string): Promise<RoomGetResponse | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (resp.status !== 200) {
      console.error(`Getting ${url} returned ${resp.status}!`);
      return null;
    }

    return await resp.json();
  } catch (error) {
    console.error(`Exception occurred while getting ${url}:`, error);
    return null;
  }
}

/**
 * A function that only returns false if the uri is a non-fetchable soundcloud uri.
 * @param uri the uri to test.
 */
export async function fetchTestSoundCloudSong(uri: string): Promise<boolean> {
  if (soundCloudSongRegex.test(uri)) {
    const stub = env.SongGuessAPI.getByName("default");
    // add dummy localhost prefix so it is a "valid" url
    const resp = await stub.fetch(`http://localhost${uri}`);

    if (!resp.ok) {
      return false;
    }
  }
  return true;
}
