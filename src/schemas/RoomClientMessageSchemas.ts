import z from "zod";
import {PlaylistSchema, SongSchema, UsernameSchema} from "./RoomSharedSchemas";


/**
 * Schema for messages requesting to return to the lobby from the game.
 */
export const ReturnToLobbyMessageSchema = z.object({
  type: z.literal("return_to_lobby").default("return_to_lobby")
});

export type ReturnToLobbyMessage = z.infer<typeof ReturnToLobbyMessageSchema>;


/**
 * Schema for messages containing the player's selected answer during a question.
 */
export const SelectAnswerMessageSchema = z.object({
  type: z.literal("select_answer").default("select_answer"),

  /**
   * The index of the selected answer.
   */
  answerIndex: z.int().min(0).max(3)
})

export type SelectAnswerMessage = z.infer<typeof SelectAnswerMessageSchema>;


/**
 * Schema for messages requesting to start a new game.
 */
export const StartGameMessageSchema = z.object({
  type: z.literal("start_game").default("start_game"),

  /**
   * The (filtered) list of songs to play in this round.
   */
  songs: z.array(SongSchema)
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


/**
 * Schema for messages requesting to add a new playlist to the game.
 */
export const AddPlaylistMessageSchema = z.object({
  type: z.literal("add_playlist").default("add_playlist"),

  /**
   * The new playlist to add.
   */
  playlist: PlaylistSchema
});

export type AddPlaylistMessage = z.infer<typeof AddPlaylistMessageSchema>;


/**
 * Schema for messages requesting to remove a playlist from the game.
 */
export const RemovePlaylistMessageSchema = z.object({
  type: z.literal("remove_playlist").default("remove_playlist"),

  /**
   * The playlist index to remove.
   */
  index: z.nullable(z.int().nonnegative())
});

export type RemovePlaylistMessage = z.infer<typeof RemovePlaylistMessageSchema>;


/**
 * Schema for messages requesting to change a player's username.
 */
export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username").default("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;