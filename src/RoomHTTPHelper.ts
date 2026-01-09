import { type RoomInfoResponse, RoomInfoResponseSchema, type PostCreateRoomResponse, PostCreateRoomResponseSchema } from "./schemas/RoomHTTPSchemas";

/**
 * Fetches room information from the specified URL.
 *
 * @param url The URL to fetch room information from.
 * @returns A Promise resolving to the room information, or null if the request fails or validation fails.
 */
export async function fetchGetRoom(url: URL|string): Promise<RoomInfoResponse|null> {
  try {
    const resp = await fetch(url, {signal: AbortSignal.timeout(5000)});
    if (resp.status !== 200) {
      console.error(`Getting ${url} returned ${resp.status}!`);
      return null;
    }

    const data = await resp.json();
    
    // make sure correct response was returned
    const result = RoomInfoResponseSchema.safeParse(data);
    if (result.success) {
      return result.data;
    } else {
      console.error(`Error validating API response while getting ${url}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`Exception occurred while getting ${url}:`, error);
    return null;
  }
}

/**
 * Sends a POST request to validate and activate a room with the provided token.
 *
 * @param urlParam The URL of the room endpoint to post to.
 * @param token The authentication token to validate the room.
 * @returns A Promise resolving to true if the room was successfully validated, false otherwise.
 */
export async function fetchPostRoom(urlParam: URL|string, token: string): Promise<boolean> {
  try {
    let url = new URL(urlParam);
    url.searchParams.delete("token");
    url.searchParams.set("token", token);

    const resp = await fetch(url, {method: "POST", signal: AbortSignal.timeout(5000)});
    if (resp.status !== 200) {
      console.error(`Posting ${url} returned ${resp.status}!`);
      return false;
    }

    // make sure correct response was returned
    return (await resp.text()) === "ok";
  } catch (error) {
    console.error(`Exception occurred while posting ${urlParam}:`, error);
    return false;
  }
}


/**
 * Sends a POST request to create a new room.
 *
 * @param url The URL of the room creation endpoint.
 * @returns A Promise resolving to the created room information, or null if the request fails or validation fails.
 */
export async function fetchPostCreateRoom(url: URL|string): Promise<PostCreateRoomResponse|null> {
  try {
    const resp = await fetch(url, {method: "POST", signal: AbortSignal.timeout(5000)});
    if (resp.status !== 201) {
      console.error(`Posting ${url} returned ${resp.status}!`);
    }

    const data = await resp.json();
    
    // make sure correct response was returned
    const result = PostCreateRoomResponseSchema.safeParse(data);
    if (result.success) {
      return result.data;
    } else {
      console.error(`Error validating API response while posting ${url}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`Exception occurred while posting ${url}:`, error);
    return null;
  }
}