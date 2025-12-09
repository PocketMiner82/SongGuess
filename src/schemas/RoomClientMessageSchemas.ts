import z from "zod";
import { PlaylistSchema, UsernameSchema } from "./RoomSharedMessageSchemas";


export const StartGameMessageSchema = z.object({
  type: z.literal("start_game")
});

export type StartGameMessage = z.infer<typeof StartGameMessageSchema>;


export const SongSchema = z.object({
  /**
   * The name of the song
   */
  name: z.string(),

  /**
   * A URL to the audio file of the song.
   * Currently only audio previews from apple music are allowed.
   */
  audioURL: z.url({pattern: /^https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\/AudioPreview.*\.m4a$/})
});

export type Song = z.infer<typeof SongSchema>;


export const HostUpdatePlaylistMessageSchema = z.object({
  type: z.literal("host_update_playlists"),

  /**
   * Currently selected playlist(s)
   */
  playlists: z.array(PlaylistSchema),

  /**
   * A list of song names and music urls
   */
  songs: z.array(SongSchema)
});

export type HostUpdatePlaylistMessage = z.infer<typeof HostUpdatePlaylistMessageSchema>;


export const ChangeUsernameMessageSchema = z.object({
  type: z.literal("change_username"),

  /**
   * The new username.
   */
  username: UsernameSchema
});

export type ChangeUsernameMessage = z.infer<typeof ChangeUsernameMessageSchema>;