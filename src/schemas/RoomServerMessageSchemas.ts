import z from "zod";
import { PlaylistSchema, SongSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const PlayerStateSchema = z.object({
  /**
   * The player's username
   */
  username: UsernameSchema,

  /**
   * The player's color
   */
  color: z.string(),

  /**
   * How many points the player has since he joined the room.
   */
  points: z.number(),

  /**
   * The time in ms where the player answered a round question.
   */
  answerTimestamp: z.optional(z.number()),

  /**
   * The index of the question the player selected.
   */
  answerIndex: z.optional(z.int().min(0).max(3))
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;


export const QuestionMessageSchema = z.object({
  type: z.literal("question").default("question"),

  /**
   * The question number, starting from one.
   */
  number: z.int().min(1),

  /**
   * The current 4 question answer options.
   */
  answerOptions: z.array(z.string()).length(4)
});

export type QuestionMessage = z.infer<typeof QuestionMessageSchema>;


export const AnswerMessageSchema = z.object({
  type: z.literal("answer").default("answer"),

  /**
   * The question number, starting from one.
   */
  number: z.int().min(1),

  /**
   * The current 4 question answer options. 
   */
  answerOptions: z.array(z.string()).length(4),

  /**
   * The index of the correct answer.
   */
  correctIndex: z.int().min(0).max(3),

  /**
   * Information about which player selected which answer
   */
  playerAnswers: z.array(PlayerStateSchema)
});

export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;


export const AudioControlMessageSchema = z.discriminatedUnion("action", [
  z.object({
    type: z.literal("audio_control").default("audio_control"),

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
    type: z.literal("audio_control").default("audio_control"),

    /**
     * - "play": Starts playback of the music.
     * - "pause": Pauses playback of the music.
     */
    action: z.literal(["play", "pause"])
  })

]);

export type AudioControlMessage = z.infer<typeof AudioControlMessageSchema>;


export const CountdownMessageSchema = z.object({
  type: z.literal("countdown").default("countdown"),

  /**
   * The current countdown number. 0 to hide.
   */
  countdown: z.int().min(0)
});

export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;


export const UpdatePlaylistsMessageSchema = z.object({
  type: z.literal("update_playlists").default("update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.array(PlaylistSchema)
});

export type UpdatePlaylistsMessage = z.infer<typeof UpdatePlaylistsMessageSchema>;


/**
 * All possible states of the game
 */
const GameStateSchema = z.literal([
  "lobby",
  "ingame",
  "results"
]);

export type GameState = z.infer<typeof GameStateSchema>;


export const UpdateMessageSchema = z.object({
  type: z.literal("update").default("update"),

  /**
   * The current game state
   */
  state: GameStateSchema,

  /**
   * A map of display names and color of the players
   */
  players: z.array(PlayerStateSchema),

  /**
   * The friendly username of the player (which the user can request to change)
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