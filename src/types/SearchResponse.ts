/**
 * Represents the quality tier and source URL of a video thumbnail.
 */
export interface VideoThumbnail {
  /** The quality designation of the thumbnail image. */
  quality: string;
  /** The HTTP URL pointing to the thumbnail image resource. */
  url: string;
  /** The horizontal dimension of the thumbnail in pixels. */
  width: number;
  /** The vertical dimension of the thumbnail in pixels. */
  height: number;
}

/**
 * Represents a single video search result item.
 */
export interface VideoSearchItem {
  /** The classification type of the search result entity. */
  type: string;
  /** The unique alphanumeric identifier assigned to the video. */
  videoId: string;
  /** The full title of the video content. */
  title: string;
  /** The textual description associated with the video content. */
  description: string;
  /** The display name of the content creator or channel. */
  author: string;
  /** The unique alphanumeric identifier of the author's channel. */
  authorId: string;
  /** The relative URI path pointing to the author's channel page. */
  authorUrl: string;
  /** The total duration of the video measured in seconds. */
  lengthSeconds: number;
  /** The Unix timestamp indicating when the video was published, or null if unavailable. */
  published: number | null;
  /** The human-readable relative time string indicating publication age, or null if unavailable. */
  publishedText: string | null;
  /** The total cumulative view count of the video, or null if unavailable. */
  viewCount: number | null;
  /** The formatted string representation of the view count. */
  viewCountText: string;
  /** The total like count, or null if unavailable. */
  likeCount: number | null;
  /** An array of available thumbnail image variants for the video. */
  videoThumbnails: VideoThumbnail[];
  /** Indicates whether the video is currently broadcasting live. */
  liveNow: boolean;
  /** Indicates whether the video is an upcoming scheduled broadcast. */
  isUpcoming: boolean;
  /** Indicates whether the video is classified as a short-form video. */
  isShort: boolean;
  /** The internal extractor service identifier, or null if not applicable. */
  extractor: string | null;
  /** The direct streaming URL for the video, or null if unavailable. */
  videoUrl: string | null;
}

/**
 * Represents the complete search response consisting of an array of video items.
 */
export type SearchResponse = VideoSearchItem[];
