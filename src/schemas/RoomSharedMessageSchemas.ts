import z from "zod";


export const PlaylistSchema = z.object({
  /**
   * Name of the playlist
   */
  playlistName: z.string(),

  /**
   * Cover URL of the playlist.
   * Currently only cover arts by Apple Music are allowed.
   */
  playlistCover: z.nullable(z.url({pattern: /^https:\/\/is.?-ssl\.mzstatic\.com\/image\/thumb\/Music.*\.jpg$/}))
});

export type Playlist = z.infer<typeof PlaylistSchema>;


export const GeneralErrorMessageSchema = z.object({
  type: z.literal("error"),

  /**
   * A string describing what went wrong.
   */
  error_message: z.string()
});

export type GeneralErrorMessage = z.infer<typeof GeneralErrorMessageSchema>;


/**
 * Allowed characters + length restriction of usernames
 */
export const UsernameSchema = z.stringFormat("user", /^[a-zA-ZäöüÄÖÜßẞ0-9_]{1,16}$/);