import type { CreateRoomResponse } from "../types/APIResponseTypes";

/**
 * Sends a POST request to create a new room.
 *
 * @param url The URL of the room creation endpoint.
 * @returns A Promise resolving to the created room information, or null if the request fails or validation fails.
 */
export async function fetchPostCreateRoom(url: URL | string): Promise<CreateRoomResponse | null> {
  try {
    const resp = await fetch(url, { method: "POST", signal: AbortSignal.timeout(5000) });
    if (resp.status !== 201) {
      console.error(`Posting ${url} returned ${resp.status}!`);
    }

    return await resp.json();
  } catch (error) {
    console.error(`Exception occurred while posting ${url}:`, error);
    return null;
  }
}
