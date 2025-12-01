import z from "zod";

const RoomInfoResponseSchema = z.object({
  onlineCount: z.number(),

  /**
   * True, if this room was created by a request to /createRoom
   * @see {@link Server#isValidRoom}
   */
  isValidRoom: z.boolean(),
});

export type RoomInfoResponse = z.infer<typeof RoomInfoResponseSchema>;


export async function fetchGetRoom(url: URL|string): Promise<RoomInfoResponse|null> {
  try {
    const resp = await fetch(url);
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

export async function fetchPushRoom(urlParam: URL|string, token: string): Promise<boolean> {
  try {
    let url = new URL(urlParam);
    url.searchParams.delete("token");
    url.searchParams.set("token", token);

    const resp = await fetch(url, {method: "PUSH"});
    if (resp.status !== 200) {
      console.error(`Pushing ${url} returned ${resp.status}!`);
      return false;
    }

    // make sure correct response was returned
    return (await resp.text()) === "ok" ? true : false;
  } catch (error) {
    console.error(`Exception occurred while pushing ${urlParam}:`, error);
    return false;
  }
}