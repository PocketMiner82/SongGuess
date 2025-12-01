import z from "zod";

const RoomInfoResponseSchema = z.object({
  /**
   * The amount of players online in the room
   * @see {@link Serverr#getOnlineCount}
   */
  onlineCount: z.number(),

  /**
   * True, if this room was created by a request to /createRoom
   * @see {@link Server#isValidRoom}
   */
  isValidRoom: z.boolean(),
});

export type RoomInfoResponse = z.infer<typeof RoomInfoResponseSchema>;

const PostCreateRoomResponseSchema = z.object({
  /**
   * The ID of the created room
   */
  roomID: z.string(),

  /**
   * If an error happend, this will contain the error message
   */
  error: z.string()
});

export type PostCreateRoomResponse = z.infer<typeof PostCreateRoomResponseSchema>;


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
    return (await resp.text()) === "ok" ? true : false;
  } catch (error) {
    console.error(`Exception occurred while posting ${urlParam}:`, error);
    return false;
  }
}


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