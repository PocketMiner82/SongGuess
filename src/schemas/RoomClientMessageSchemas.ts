import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const StartGameMessageSchema = z.object({
  type: z.literal("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


export const HostUpdatePlaylistMessageSchema = z.object({
  type: z.literal("host_update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.array(PlaylistSchema)
});

export type HostUpdatePlaylistMessage = z.infer<typeof HostUpdatePlaylistMessageSchema>;


export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;