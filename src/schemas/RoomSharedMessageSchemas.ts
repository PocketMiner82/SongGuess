import z from "zod";


/**
 * Available player colors that can be assigned to players in the game room.
 */
export const COLORS = ["Red", "DarkGreen", "Blue", "Orange", "LawnGreen", "Black", "White", "Cyan"];

/**
 * Regular expression to validate Apple Music artist URLs.
 */
export const artistRegex = /^(https?:\/\/music\.apple\.com\/[^/]+\/artist\/[^/]+\/(?<id>\d+);?)+$/
/**
 * Regular expression to validate Apple Music album URLs.
 */
export const albumRegex =  /^(https?:\/\/music\.apple\.com\/[^/]+\/album\/[^/]+\/(?<id>\d+)(?:\?.*i=(?<trackId>\d+))?;?)+$/
/**
 * Regular expression to validate Apple Music song URLs.
 */
export const songRegex =   /^(https?:\/\/music\.apple\.com\/[^/]+\/(?<song>song)\/[^/]+\/(?<id>\d+);?)+$/

export const SongSchema = z.object({
  /**
   * The name of the song
   */
  name: z.string(),

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
   * Cover URL of the playlist.
   * Currently only cover arts by Apple Music are allowed.
   */
  cover: z.nullable(z.url({pattern: /^https:\/\/is.?-ssl\.mzstatic\.com\/image\/thumb\/Music.*\.jpg$/})),

  /**
   * A list of song names and music urls
   */
  songs: z.optional(z.array(SongSchema))
});

export type Playlist = z.infer<typeof PlaylistSchema>;

/**
 * Default playlist object used when playlist information cannot be retrieved or is invalid.
 */
export const UnknownPlaylist: Playlist = {
  name: "Unknown",
  cover: null,
  songs: []
};


/**
 * Allowed characters + length restriction of usernames
 */
export const UsernameSchema = z.stringFormat("user", /^[a-zA-ZäöüÄÖÜßẞ0-9_]{1,16}$/);