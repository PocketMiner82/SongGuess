import {
  AddPlaylistMessageSchema, ChangeUsernameMessageSchema, RemovePlaylistMessageSchema, ReturnToMessageSchema,
  SelectAnswerMessageSchema,
  StartGameMessageSchema
} from "../schemas/ClientMessageSchemas";
import z from "zod";
import {
  ClientMessageSchema,
  ConfirmationMessageSchema,
  PingMessageSchema, PongMessageSchema,
  type RoomConfigMessageSchema, ServerMessageSchema,
  SourceMessageSchema
} from "../schemas/MessageSchemas";
import {PlaylistSchema, PlaylistsFileSchema, type SongSchema} from "../schemas/SharedSchemas";
import {
  AnswerMessageSchema,
  AudioControlMessageSchema, CountdownMessageSchema, GameStateSchema,
  type PlayerStateSchema,
  QuestionMessageSchema, UpdateMessageSchema, UpdatePlayedSongsMessageSchema, UpdatePlaylistsMessageSchema
} from "../schemas/ServerMessageSchemas";

export type SelectAnswerMessage = z.infer<typeof SelectAnswerMessageSchema>;
export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;
export type AddPlaylistMessage = z.infer<typeof AddPlaylistMessageSchema>;
export type RemovePlaylistMessage = z.infer<typeof RemovePlaylistMessageSchema>;
export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;
export type RoomConfigMessage = z.infer<typeof RoomConfigMessageSchema>;
export type SourceMessage = z.infer<typeof SourceMessageSchema>;
export type ConfirmationMessage = z.infer<typeof ConfirmationMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type Song = z.infer<typeof SongSchema>;
export type Playlist = z.infer<typeof PlaylistSchema>;
export type PlaylistsFile = z.infer<typeof PlaylistsFileSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type QuestionMessage = z.infer<typeof QuestionMessageSchema>;
export type AnswerMessage = z.infer<typeof AnswerMessageSchema>;
export type AudioControlMessage = z.infer<typeof AudioControlMessageSchema>;
export type CountdownMessage = z.infer<typeof CountdownMessageSchema>;
export type UpdatePlayedSongsMessage = z.infer<typeof UpdatePlayedSongsMessageSchema>;
export type UpdatePlaylistsMessage = z.infer<typeof UpdatePlaylistsMessageSchema>;
export type GameState = z.infer<typeof GameStateSchema>;
export type UpdateMessage = z.infer<typeof UpdateMessageSchema>;
export type ReturnToMessage = z.infer<typeof ReturnToMessageSchema>;

/**
 * Default playlist object used when playlist information cannot be retrieved or is invalid.
 */
export const DefaultPlaylist: Playlist = {
  name: "Unknown",
  hrefURL: "https://music.apple.com/us/",
  cover: null,
  songs: []
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
}