import z from "zod";


/**
 * Countdown sent by server to clients.
 */
export const CountdownMessageSchema = z.object({
  type: z.literal("countdown"),

  /**
   * The current count.
   */
  countdown: z.uint32()
});

export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;


/**
 * Request to start game sent by host to server
 */
export const StartGameMessageSchema = z.object({
  type: z.literal("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


/**
 * Playlist update sent by client or server.
 */
export const UpdatePlaylistMessageSchema = z.object({
  type: z.literal("update_playlist"),

  /**
   * Currently selected playlist name
   */
  playlistName: z.string(),

  /**
   * Currently select playlist album cover url
   */
  playlistCover: z.url(),

  /**
   * If this message is sent by the host, it may contain a map of song names and music urls for the server
   */
  playlistSongs: z.optional(z.map(z.string(), z.url()))
});

export type UpdatePlaylistMessage = z.infer<typeof UpdatePlaylistMessageSchema>;


/**
 * Allowed characters + length restriction of usernames
 */
const UsernameSchma = z.stringFormat("user", /^[a-zA-ZäöüÄÖÜßẞ0-9_]{1,16}$/);


/**
 * A request sent by a client to change its username
 */
export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchma
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;


const GameStateSchema = z.literal([
  "lobby",
  "ingame",
  "results"
]);

/**
 * All possible states of the game
 */
export type GameState = z.infer<typeof GameStateSchema>;


/**
 * An update sent by the server to the clients.
 * Updates player list and whether the player is host.
 */
export const UpdateMessageSchema = z.object({
  type: z.literal("update"),

  /**
   * The current game state
   */
  state: GameStateSchema,

  /**
   * A map of display names and color of the players
   */
  players: z.array(z.tuple([z.string(), z.string()])),

  /**
   * The friendly username of the player (which the user can reqest to change)
   */
  username: UsernameSchma,

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


/**
 * Sent by client/server if an error happened
 */
export const ErrorMessageSchema = z.object({
  type: z.literal("error"),

  /**
   * A string describing what went wrong.
   */
  error: z.string()
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;


/**
 * A message from client or server.
 */
export const MessageSchema = z.union([UpdateMessageSchema, UpdatePlaylistMessageSchema]);

export type Message = z.infer<typeof MessageSchema>;