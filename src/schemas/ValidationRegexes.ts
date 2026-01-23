/**
 * Regex of the allowed username characters + length restriction
 */
export const usernameRegex = /^(?! )(?!.* $)[a-zA-ZäöüÄÖÜßẞ0-9!"§$%&/(){}[\]=?*'#+|,.;:~@€µ´`<>_ -]{1,16}$/;

/**
 * Regular expression to validate that a URL starts with the apple music domain.
 */
export const appleMusicRegex = /^https?:\/\/music\.apple\.com\/[^/]+\//;

/**
 * Regular expression to validate a preview URL.
 */
export const appleMusicPreviewRegex = /^https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\/AudioPreview.*\.m4a$/;

/**
 * Regular expression to validate cover/image urls.
 */
export const appleMusicCoverRegex = /^https:\/\/is.?-ssl\.mzstatic\.com\/image\/thumb\/Music.*\.jpg$/;

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
