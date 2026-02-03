import z from "zod";
import { PlaylistSchema, SongSchema, UsernameSchema } from "./SharedSchemas";


/**
 * Schema for representing the current state of a player in the game room.
 */
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
   * How many points player has since he joined the room.
   */
  points: z.number(),

  /**
   * The last question the player answered for.
   */
  questionNumber: z.optional(z.number()),

  /**
   * The absolute time in ms where the player answered a round question.
   */
  answerTimestamp: z.optional(z.number()),

  /**
   * The relative time in ms a player took to answer a round question.
   */
  answerSpeed: z.optional(z.number()),

  /**
   * The index of the question the player selected.
   */
  answerIndex: z.optional(z.int().min(0).max(3))
});


/**
 * Schema for messages containing a song guessing question.
 */
export const QuestionMessageSchema = z.object({
  type: z.literal("question").default("question"),

  /**
   * The question number, starting from one.
   */
  number: z.int().min(1),

  /**
   * The current 4 question answer options.
   */
  answerOptions: z.array(z.string()).length(4),

  /**
   * The random start position index (0-2) for this question.
   * @see RoomConfigMessageSchema.audioStartPosition
   */
  rndStartPos: z.number().min(0).max(2),
});


/**
 * Schema for messages containing the answer to a question and player responses.
 */
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
  correctAnswer: z.int().min(0).max(3)
});


/**
 * Schema for messages controlling audio playback during the game.
 */
export const AudioControlMessageSchema = z.discriminatedUnion("action", [
  z.object({
    type: z.literal("audio_control").default("audio_control"),

    /**
     * - "load": Downloads the music.
     */
    action: z.literal("load"),

    /**
     * The elapsed time in seconds from the start of the load request.
     */
    position: z.number().nonnegative(),

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
    action: z.literal(["play", "pause"]),

    /**
     * The elapsed time in seconds from the start of the audio track.
     */
    position: z.number().nonnegative()
  })

]);


/**
 * Schema for messages containing the current countdown value.
 */
export const CountdownMessageSchema = z.object({
  type: z.literal("countdown").default("countdown"),

  /**
   * The current countdown number. 0 to hide.
   */
  countdown: z.int().min(0)
});


export const UpdatePlayedSongsMessageSchema = z.object({
  type: z.literal("update_played_songs").default("update_played_songs"),

  /**
   * The songs that were played in this round.
   */
  songs: z.array(SongSchema)
});


/**
 * Schema for messages containing updates to the current playlists.
 */
export const UpdatePlaylistsMessageSchema = z.object({
  type: z.literal("update_playlists").default("update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.optional(z.array(PlaylistSchema)),

  /**
   * The count of filtered songs.
   * @see {@link filterSongs}
   */
  filteredSongsCount: z.number().nonnegative()
});


/**
 * All possible states of the game
 */
export const GameStateSchema = z.literal([
  "lobby",
  "ingame",
  "results"
]);


/**
 * Schema for messages containing the current room state update.
 */
export const UpdateMessageSchema = z.object({
  type: z.literal("update").default("update"),

  /**
   * The current {@link version} of the server.
   */
  version: z.string(),

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