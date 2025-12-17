import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const StartGameMessageSchema = z.object({
  type: z.literal("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


export const HostAddPlaylistMessageSchema = z.object({
  type: z.literal("host_add_playlist"),

  /**
   * The new playlist to add.
   */
  playlist: PlaylistSchema
});

export type HostAddPlaylistMessage = z.infer<typeof HostAddPlaylistMessageSchema>;


export const HostRemovePlaylistMessageSchema = z.object({
  type: z.literal("host_remove_playlist"),

  /**
   * The playlist index to remove.
   */
  index: z.number().int().nonnegative()
});

export type HostRemovePlaylistMessage = z.infer<typeof HostRemovePlaylistMessageSchema>;


export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;