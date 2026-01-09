import z from "zod";


/**
 * Allowed characters + length restriction of usernames
 */
export const UsernameSchema = z.stringFormat("user", /^[a-zA-ZäöüÄÖÜßẞ0-9_]{1,16}$/);

/**
 * Regular expression to validate that a URL starts with the apple music domain.
 */
export const appleMusicRegex = /^https?:\/\/music\.apple\.com\/[^/]+\//;

/**
 * Regular expression to validate cover/image urls.
 */
export const appleMusicCoverRegex = /^https:\/\/is.?-ssl\.mzstatic\.com\/image\/thumb\/Music.*\.jpg$/;

/**
 * Regular expression to validate Apple Music artist URLs.
 */
export const artistRegex = new RegExp(`^(${appleMusicRegex.source}artist/[^/]+/(?<id>\\d+);?)+$`);
/**
 * Regular expression to validate Apple Music album URLs.
 */
export const albumRegex =  new RegExp(`^(${appleMusicRegex.source}album/[^/]+/(?<id>\\d+)(?:\\?.*i=(?<trackId>\\d+))?;?)+$`);
/**
 * Regular expression to validate Apple Music song URLs.
 */
export const songRegex =   new RegExp(`^(${appleMusicRegex.source}(?<song>song)/[^/]+/(?<id>\\d+);?)+$`);

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
  audioURL: z.url({pattern: /^https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\/AudioPreview.*\.m4a$/})
});

export type Song = z.infer<typeof SongSchema>;

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

export type Playlist = z.infer<typeof PlaylistSchema>;


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

export type PlaylistsFile = z.infer<typeof PlaylistsFileSchema>;


/**
 * Default playlist object used when playlist information cannot be retrieved or is invalid.
 */
export const UnknownPlaylist: Playlist = {
  name: "Unknown",
  hrefURL: "https://music.apple.com/us/",
  cover: null,
  songs: []
};