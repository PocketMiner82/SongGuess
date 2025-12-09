import z from "zod";


export const RoomInfoResponseSchema = z.object({
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

export const PostCreateRoomResponseSchema = z.object({
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