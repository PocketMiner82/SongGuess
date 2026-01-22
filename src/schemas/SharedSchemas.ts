import z from "zod";
import {appleMusicCoverRegex, appleMusicPreviewRegex, appleMusicRegex, usernameRegex} from "./ValidationRegexes";

/**
 * The zod schema for the username.
 */
export const UsernameSchema = z.stringFormat("user", usernameRegex);


export const SongSchema = z.object({
  /**
   * The name of the song.
   */
  name: z.string(),

  /**
   * The name of the song artist.
   */
  artist: z.string(),

  /**
   * The URL users will be redirected to when clicking.
   */
  hrefURL: z.url({pattern: appleMusicRegex}),

  /**
   * Cover URL of the song.
   */
  cover: z.nullable(z.url({pattern: appleMusicCoverRegex})),

  /**
   * A URL to the audio file of the song.
   * Currently only audio previews from Apple Music are allowed.
   */
  audioURL: z.url({pattern: appleMusicPreviewRegex})
});

export const PlaylistSchema = z.object({
  /**
   * Name of the playlist
   */
  name: z.string(),

  /**
   * An optional subtitle with additional information about the playlist
   */
  subtitle: z.optional(z.string()),

  /**
   * The URL users will be redirected to when clicking.
   */
  hrefURL: z.url({pattern: appleMusicRegex}),

  /**
   * Cover URL of the playlist.
   */
  cover: z.nullable(z.url({pattern: appleMusicCoverRegex})),

  /**
   * A list of song names and music urls
   */
  songs: z.array(SongSchema)
});


export const PlaylistsFileSchema = z.object({
  /**
   * Version of this export. Only used for validation.
   */
  version: z.literal("1.0").default("1.0"),

  /**
   * The playlists of this export.
   */
  playlists: z.array(PlaylistSchema)
});


export const RoomConfigMessageSchema = z.object({
  type: z.literal("room_config").default("room_config"),

  /**
   * Whether to perform advanced filtering tactics when generating the songs array.
   * Currently just ignores parens when filtering for identical song names.
   */
  advancedSongFiltering: z.boolean(),

  /**
   * Whether to directly end the round after all players answered.
   */
  endWhenAnswered: z.boolean(),

  /**
   * The amount of questions to ask per round.
   */
  questionCount: z.number().min(1).max(30)
});


export const PingMessageSchema = z.object({
  type: z.literal("ping").default("ping"),

  /**
   * The sequence number the pong should respond with
   */
  seq: z.number()
});


export const PongMessageSchema = z.object({
  type: z.literal("pong").default("pong"),

  /**
   * The sequence number asked for in the ping packet.
   */
  seq: z.number()
});