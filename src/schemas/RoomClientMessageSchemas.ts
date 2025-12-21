import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const StartGameMessageSchema = z.object({
  type: z.literal("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


export const AddPlaylistMessageSchema = z.object({
  type: z.literal("add_playlist"),

  /**
   * The new playlist to add.
   */
  playlist: PlaylistSchema
});

export type AddPlaylistMessage = z.infer<typeof AddPlaylistMessageSchema>;


export const RemovePlaylistMessageSchema = z.object({
  type: z.literal("remove_playlist"),

  /**
   * The playlist index to remove.
   */
  index: z.int().nonnegative()
});

export type RemovePlaylistMessage = z.infer<typeof RemovePlaylistMessageSchema>;


export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;