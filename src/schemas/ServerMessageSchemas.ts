import z from "zod";
import GamePhase from "../shared/game/GamePhase";
import { PlaylistSchema, SongSchema, UsernameSchema } from "./SharedSchemas";


/**
 * Updates and starts the progressbar on the client.
 */
export const ProgressbarUpdateMessageSchema = z.object({
  type: z.literal("progressbar_update").default("progressbar_update"),

  /**
   * The number of seconds to offset the progress bar start point.
   */
  offset: z.number(),

  /**
   * The duration of the progressbar.
   */
  duration: z.number(),
});

/**
 * Schema representing a question.
 */
const QuestionMessageSchema = z.object({
  /**
   * The random/user-defined audio start position index (0-2) for the current question.
   * @see RoomConfigMessageSchema.audioStartPosition
   */
  startPos: z.number().min(0).max(2),
});

export const MultipleChoiceQuestionMessageSchema = QuestionMessageSchema.extend({
  questionType: z.literal("multiple_choice"),

  /**
   * The current 4 question answer options.
   */
  answerOptions: z.array(z.string()).length(4),

  /**
   * The index of the correct answer, if answer is shown.
   */
  correctAnswerIndex: z.optional(z.int().min(0).max(3)),
});

export const PlayerPicksQuestionMessageSchema = QuestionMessageSchema.extend({
  questionType: z.literal("player_picks"),

  /**
   * The current question number in this round, starting from 1.
   */
  questionCurrent: z.int().min(1),

  /**
   * The amount of questions in this round.
   */
  questionCount: z.int(),

  /**
   * The correct song that was requested this round, if answer is shown.
   */
  correctAnswer: z.optional(SongSchema),

  /**
   * The picker uuid for this message
   */
  pickerId: z.string(),
});

/**
 * Schema for messages containing information about the current round.
 */
export const RoundMessageSchema = z.object({
  type: z.literal("round").default("round"),

  /**
   * The current game phase.
   * @see GamePhase
   */
  gamePhase: z.enum(GamePhase),

  /**
   * The round number, starting from one.
   */
  roundCurrent: z.int().min(1),

  question: z.optional(z.union([
    MultipleChoiceQuestionMessageSchema,
    PlayerPicksQuestionMessageSchema,
  ])),
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
     * URL to load music from.
     * @see {@link SongSchema.shape.audioURL}
     */
    audioURL: SongSchema.shape.audioURL,
  }),
  z.object({
    type: z.literal("audio_control").default("audio_control"),

    /**
     * - "play": Starts playback of the music.
     * - "pause": Pauses playback of the music.
     */
    action: z.literal(["play", "pause"]),
  }),
]);

/**
 * Schema for the possible answer a player gave to a question.
 */
export const PlayerAnswerDataSchema = z.object({
  /**
   * The absolute time in ms where the player answered a round question.
   */
  answerTimestamp: z.number(),

  /**
   * The relative time in ms a player took to answer a round question.
   */
  answerSpeed: z.number(),

  /**
   * The points the player got for the current question.
   */
  questionPoints: z.number(),

  /**
   * Provided only for MultipleChoiceGame.
   * The index of the question the player selected.
   */
  answerIndex: z.optional(z.int().min(0).max(3)),

  /**
   * Provided only for PlayerPicksGame.
   * The answer the player selected.
   */
  answer: z.optional(z.string()),
});

/**
 * Schema for messages containing the current countdown value.
 */
export const CountdownMessageSchema = z.object({
  type: z.literal("countdown").default("countdown"),

  /**
   * The current countdown number. 0 to hide.
   */
  countdown: z.int().min(0),
});

export const UpdatePlayedSongsMessageSchema = z.object({
  type: z.literal("update_played_songs").default("update_played_songs"),

  /**
   * The songs that were played in this round.
   */
  songs: z.array(SongSchema),
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
  filteredSongsCount: z.number().nonnegative(),
});

/**
 * All possible states of the game
 */
export const GameStateSchema = z.literal([
  "lobby",
  "ingame",
  "results",
]);

/**
 * Schema containing information about a player.
 */
export const PlayerMessageSchema = z.object({
  /**
   * The player's username
   */
  username: UsernameSchema,

  /**
   * The player's color
   */
  color: z.string(),

  /**
   * How many points the player had in the last round.
   */
  points: z.number(),

  /**
   * The current answer of this player.
   */
  answerData: z.optional(PlayerAnswerDataSchema),
});

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
   * A map of all active (online, non-spectating) players. Key is server generated uuid, NOT connection id.
   */
  players: z.record(z.string(), PlayerMessageSchema),

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
  isHost: z.boolean(),
});
