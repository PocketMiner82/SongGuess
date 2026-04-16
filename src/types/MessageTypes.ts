import type z from "zod";
import type {
  AddPlaylistsMessageSchema,
  ChangeUsernameMessageSchema,
  PlayerPickSongMessageSchema,
  RemovePlaylistMessageSchema,
  ReturnToMessageSchema,
  SelectAnswerMessageSchema,
  StartGameMessageSchema,
  TransferHostMessageSchema,
} from "../schemas/ClientMessageSchemas";
import type {
  ClientMessageSchema,
  ConfirmationMessageSchema,
  ServerMessageSchema,
  SourceMessageSchema,
} from "../schemas/MessageSchemas";
import type { AddLogMessageSchema, UpdateLogMessagesSchema } from "../schemas/ServerAdminMessageSchemas";
import type {
  AnswerMessageSchema,
  AudioControlMessageSchema,
  CountdownMessageSchema,
  GameStateSchema,
  PlayerAnswerDataSchema,
  PlayerMessageSchema,
  QuestionMessageSchema,
  UpdateMessageSchema,
  UpdatePlayedSongsMessageSchema,
  UpdatePlaylistsMessageSchema,

} from "../schemas/ServerMessageSchemas";
import type {
  PingMessageSchema,
  PlaylistSchema,
  PlaylistsFileSchema,
  PongMessageSchema,
  RoomConfigMessageSchema,
  SongSchema,
} from "../schemas/SharedSchemas";

/**
 * Message sent when a player picks a song for others to guess.
 */
export type PlayerPicksSongMessage = z.infer<typeof PlayerPickSongMessageSchema>;
/**
 * Message sent when a player selects an answer in player picks mode.
 */
export type SelectAnswerMessage = z.infer<typeof SelectAnswerMessageSchema>;
/**
 * Message sent by host to start the game.
 */
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
/**
 * Message sent to add playlists to the room.
 */
export type AddPlaylistsMessage = z.infer<typeof AddPlaylistsMessageSchema>;
/**
 * Message sent to remove a playlist from the room.
 */
export type RemovePlaylistMessage = z.infer<typeof RemovePlaylistMessageSchema>;
/**
 * Message sent when a player changes their username.
 */
export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;
/**
 * Message containing room configuration settings.
 */
export type RoomConfigMessage = z.infer<typeof RoomConfigMessageSchema>;
/**
 * Message containing source information (playlist/song) for questions.
 */
export type SourceMessage = z.infer<typeof SourceMessageSchema>;
/**
 * Confirmation message sent in response to a client action.
 */
export type ConfirmationMessage = z.infer<typeof ConfirmationMessageSchema>;
/**
 * Ping message sent to measure round-trip time.
 */
export type PingMessage = z.infer<typeof PingMessageSchema>;
/**
 * Pong message sent in response to ping.
 */
export type PongMessage = z.infer<typeof PongMessageSchema>;
/**
 * Union type of all server-to-client messages.
 */
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
/**
 * Union type of all client-to-server messages.
 */
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
/**
 * Represents a song with metadata from Apple Music.
 */
export type Song = z.infer<typeof SongSchema>;
/**
 * Represents a playlist containing songs.
 */
export type Playlist = z.infer<typeof PlaylistSchema>;
/**
 * File format for importing/exporting playlists.
 */
export type PlaylistsFile = z.infer<typeof PlaylistsFileSchema>;
/**
 * Represents a player in the game with their state and score.
 */
export type PlayerMessage = z.infer<typeof PlayerMessageSchema>;
/**
 * Data about a player's answer including correctness and timing.
 */
export type PlayerAnswerData = z.infer<typeof PlayerAnswerDataSchema>;
/**
 * Message containing a question for players to answer.
 */
export type QuestionMessage = z.infer<typeof QuestionMessageSchema>;
/**
 * Message sent when the correct answer is revealed.
 */
export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;
/**
 * Message to control audio playback (load/play/pause).
 */
export type AudioControlMessage = z.infer<typeof AudioControlMessageSchema>;
/**
 * Message sent to display a countdown before questions.
 */
export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;
/**
 * Message updating the list of played songs.
 */
export type UpdatePlayedSongsMessage = z.infer<typeof UpdatePlayedSongsMessageSchema>;
/**
 * Message updating the available playlists.
 */
export type UpdatePlaylistsMessage = z.infer<typeof UpdatePlaylistsMessageSchema>;
/**
 * Current state of the game including players and scores.
 */
export type GameState = z.infer<typeof GameStateSchema>;
/**
 * Generic update message for game state changes.
 */
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;
/**
 * Message to return to a previous game phase.
 */
export type ReturnToMessage = z.infer<typeof ReturnToMessageSchema>;
/**
 * Message to add a log entry to the admin console.
 */
export type AddLogMessage = z.infer<typeof AddLogMessageSchema>;
/**
 * Message to update multiple log messages at once.
 */
export type UpdateLogMessages = z.infer<typeof UpdateLogMessagesSchema>;
/**
 * Message to transfer host privileges to another player.
 */
export type TransferHostMessage = z.infer<typeof TransferHostMessageSchema>;

/**
 * Default playlist object used when playlist information cannot be retrieved or is invalid.
 */
export const DefaultPlaylist: Playlist = {
  name: "Unknown",
  hrefURL: "https://music.apple.com/us/",
  cover: null,
  songs: [],
};

/**
 * Default song object used when song information cannot be retrieved or is invalid.
 */
export const DefaultSong: Song = {
  name: "Unknown",
  artist: "Unknown",
  cover: null,
  hrefURL: "https://music.apple.com/us/",
  audioURL: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview.m4a",
};
