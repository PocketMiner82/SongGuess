import z from "zod";

const PushCreateRoomResponseSchema = z.object({
  roomID: z.string()
});

export type PushCreateRoomResponse = z.infer<typeof PushCreateRoomResponseSchema>;


export async function fetchPushCreateRoom(url: URL|string): Promise<PushCreateRoomResponse|null> {
  try {
    const resp = await fetch(url, {method: "PUSH"});
    if (resp.status !== 200) {
      console.error(`Pushing ${url} returned ${resp.status}!`);
      return null;
    }

    const data = await resp.json();
    
    // make sure correct response was returned
    const result = PushCreateRoomResponseSchema.safeParse(data);
    if (result.success) {
      return result.data;
    } else {
      console.error(`Error validating API response while pushing ${url}:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`Exception occurred while pushing ${url}:`, error);
    return null;
  }
}