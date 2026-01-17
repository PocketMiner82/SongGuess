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