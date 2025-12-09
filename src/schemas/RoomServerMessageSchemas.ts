import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const CountdownMessageSchema = z.object({
  type: z.literal("countdown"),

  /**
   * The current countdown number.
   */
  countdown: z.uint32()
});

export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;


export const ServerUpdatePlaylistMessageSchema = z.object({
  type: z.literal("server_update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.array(PlaylistSchema),

  /**
   * Optional error information:
   * - "not_host": only the host can update playlist(s)
   * - "not_in_lobby": playlist(s) can only be updated while in lobby
   */
  error: z.optional(z.literal(["not_host", "not_in_lobby"]))
});

export type ServerUpdatePlaylistMessage = z.infer<typeof ServerUpdatePlaylistMessageSchema>;


/**
 * All possible states of the game
 */
const GameStateSchema = z.literal([
  "lobby",
  "ingame",
  "results"
]);

export type GameState = z.infer<typeof GameStateSchema>;


/**
 * The current state of a player.
 */
const PlayerStateSchema = z.object({
  /**
   * The player's username
   */
  username: UsernameSchema,

  /**
   * The player's color
   */
  color: z.string()
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;


export const UpdateMessageSchema = z.object({
  type: z.literal("update"),

  /**
   * The current game state
   */
  state: GameStateSchema,

  /**
   * A map of display names and color of the players
   */
  players: z.array(PlayerStateSchema),

  /**
   * The friendly username of the player (which the user can reqest to change)
   */
  username: UsernameSchema,

  /**
   * The color of the user
   */
  color: z.string(),

  /**
   * True, if the receiver is the host
   */
  isHost: z.boolean(),

  /**
   * Optional error information:
   * - "not_host": only the host can perform the requested operation
   * - "not_in_lobby": the requested operation can only be performed in the lobby
   */
  error: z.optional(z.literal(["not_host", "not_in_lobby"]))
});

export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;