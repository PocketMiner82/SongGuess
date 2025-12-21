import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const QuestionVoteSchema = z.object({
  type: z.literal("question_vote").default("question_vote"),

  /**
   * The index of the correct answer.
   */
  questionIndex: z.int().min(0).max(3)
})


export const StartGameMessageSchema = z.object({
  type: z.literal("start_game").default("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


export const AddPlaylistMessageSchema = z.object({
  type: z.literal("add_playlist").default("add_playlist"),

  /**
   * The new playlist to add.
   */
  playlist: PlaylistSchema
});

export type AddPlaylistMessage = z.infer<typeof AddPlaylistMessageSchema>;


export const RemovePlaylistMessageSchema = z.object({
  type: z.literal("remove_playlist").default("remove_playlist"),

  /**
   * The playlist index to remove.
   */
  index: z.int().nonnegative()
});

export type RemovePlaylistMessage = z.infer<typeof RemovePlaylistMessageSchema>;


export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username").default("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;