import z from "zod";
import { PlaylistSchema, SongSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const AudioControlMessageSchema = z.discriminatedUnion("action", [
  z.object({
    type: z.literal("audio_control"),

    /**
     * - "load": Downloads the music.
     */
    action: z.literal("load"),

    /**
     * URL to load music from.
     * @see {@link SongSchema.shape.audioURL}
     */
    audioURL: SongSchema.shape.audioURL
  }),
  z.object({
    type: z.literal("audio_control"),

    /**
     * - "play": Starts playback of the music.
     * - "pause": Pauses playback of the music.
     */
    action: z.literal(["play", "pause"])
  })

]);

export type AudioControlMessage = z.infer<typeof AudioControlMessageSchema>;


export const CountdownMessageSchema = z.object({
  type: z.literal("countdown"),

  /**
   * The current countdown number. 0 to hide.
   */
  countdown: z.uint32()
});

export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;


export const ServerUpdatePlaylistMessageSchema = z.object({
  type: z.literal("server_update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.array(PlaylistSchema)
});

export type ServerUpdatePlaylistMessage = z.infer<typeof ServerUpdatePlaylistMessageSchema>;


/**
 * All possible states of the game
 */
const GameStateSchema = z.literal([
  "lobby",
  "ingame_question",
  "ingame_guessing",
  "ingame_results",
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
  isHost: z.boolean()
});

export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;