import type { SongsEndpointTypes } from "@syncfm/applemusic-api";
import type { AxiosInstance } from "axios";
import type { SoundcloudTrack } from "soundcloud.ts";
import type { CreateRoomResponse } from "../../types/APIResponseTypes";
import type { Playlist, Song } from "../../types/MessageTypes";
import type { SearchResponse } from "../../types/SearchResponse";
import type { SoundCloudStreams } from "./SoundCloudAPI";
import { AppleMusicConfig, AuthType, getAuthenticatedAxios, Region } from "@syncfm/applemusic-api";
import { env } from "cloudflare:workers";
import { Server } from "partyserver";
import { albumRegex, appleMusicPreviewRegex, artistRegex, songRegex } from "../../schemas/ValidationRegexes";
import { fixedAppleMusicCoverSize, fixedSoundCloudCoverSize } from "../../shared/Utils";
import { DefaultPlaylist } from "../../types/MessageTypes";
import { SoundCloudAPI } from "./SoundCloudAPI";


interface InFlightEntry {
  headers: Headers;
  status: number;
  statusText: string;
  stream: ReadableStream;
}

/**
 * Handles API requests to the /api/{endpoint} endpoints.
 */
export class SongGuessAPI extends Server<Env> {
  /**
   * Client used for communication with Apple Music API.
   */
  axiosClient: AxiosInstance | null = null;

  /**
   * Client used for communication with SoundCloud API.
   */
  soundCloud: SoundCloudAPI = new SoundCloudAPI(this, this.env.SOUNDCLOUD_CLIENT_ID as string, this.env.SOUNDCLOUD_CLIENT_SECRET as string);

  /**
   * Internal registry tracking active, ongoing fetch operations within this DO instance.
   */
  private inFlightRequests: Map<string, Promise<InFlightEntry>> = new Map();


  /**
   * Returns the current {@link this.ctx}
   */
  public getCtx() {
    return this.ctx;
  }

  private async fetchYTAudio(videoId: string): Promise<Response> {
    try {
      const headers: Headers = new Headers();
      headers.set("Authorization", `Basic ${env.YATTEE_AUTH}`);

      const audioResponse = await fetch(`${env.YATTEE_SERVER}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        headers,
      });

      if (!audioResponse.ok) {
        console.warn(`[YT] Fetching Audio failed: ${audioResponse.status} ${audioResponse.statusText}`);
        return new Response(`Error fetching audio: ${audioResponse.status}.`, { status: 500 });
      }

      const vid = await audioResponse.json() as {
        adaptiveFormats: {
          url: string;
          bitrate?: string;
          type?: string;
          audioTrack?: {
            id: string;
            displayName: string;
            isDefault: boolean;
          };
        }[];
      };
      const adaptiveFormats = vid.adaptiveFormats;

      let originalStreams = adaptiveFormats.filter((stream) => {
        return stream.audioTrack && stream.audioTrack.isDefault;
      });

      if (originalStreams.length === 0) {
        // retry including all (even non default)
        originalStreams = adaptiveFormats.filter((stream) => {
          return stream.audioTrack;
        });
        if (originalStreams.length === 0) {
          return new Response("Couldn't find working audio url.", { status: 500 });
        }
      }

      originalStreams.sort((a, b) => {
        const bitrateA = parseInt(a.bitrate || "0", 10);
        const bitrateB = parseInt(b.bitrate || "0", 10);

        // select worst bitrate for fast download
        if (bitrateB !== bitrateA) {
          return bitrateA - bitrateB;
        }

        // Fallback preference: WebM (Opus) over M4A (AAC)
        const isOpusA = a.type?.includes("webm") ? 1 : 0;
        const isOpusB = b.type?.includes("webm") ? 1 : 0;
        return isOpusB - isOpusA;
      });

      return fetch(originalStreams[0].url);
    } catch (e) {
      console.error(e);
      return new Response("Internal server error during audio extraction.", { status: 500 });
    }
  }

  private async searchYT(query: string): Promise<Response> {
    const headers: Headers = new Headers();
    headers.set("Authorization", `Basic ${env.YATTEE_AUTH}`);

    const resp = await fetch(`${env.YATTEE_SERVER}/api/v1/search?q=${encodeURIComponent(query)}`, {
      headers,
    });

    if (!resp.ok) {
      console.warn(`[YT] Search failed: ${resp.status} ${resp.statusText}`);
      return new Response(`Search failed: ${resp.status}`, { status: 500 });
    }

    const ytResults: SearchResponse = await resp.json();

    const songs: Song[] = ytResults.reduce((filtered, vid) => {
      if (vid.lengthSeconds <= 900) {
        filtered.push({
          name: vid.title,
          artist: vid.author,
          hrefURL: `https://youtu.be/${vid.videoId}`,
          cover: vid.videoThumbnails.reduce((prev, current) => {
            return (current.width > prev.width) ? current : prev;
          }).url,
          audioURL: `/api/fetchYTAudio?v=${vid.videoId}`,
        } satisfies Song);
      }

      return filtered;
    }, [] as Song[]);

    return Response.json(songs);
  }

  private async fetchSoundCloudAudio(urn: string): Promise<Response> {
    const streams: SoundCloudStreams = await this.soundCloud.fetchGetJson(`/tracks/${urn}/streams`);

    const audioUrl = streams.hls_aac_160_url
      ?? streams.hls_mp3_128_url
      ?? streams.http_mp3_128_url
      ?? `/tracks/${urn}/preview`;

    const resp = await this.soundCloud.fetchGet(audioUrl);
    if (resp.ok) {
      return resp;
    }

    return new Response("Couldn't find fetchable stream url.", { status: 500 });
  }

  private async searchSoundCloud(query: string): Promise<Song[]> {
    const tracks: SoundcloudTrack[] = await this.soundCloud.fetchGetJson("/tracks", {
      "q": query,
      // require at least 5 seconds
      "duration[from]": "5000",
      // limit to 15min max
      "duration[to]": "900000",
    });

    return tracks.map(col => ({
      name: col.title,
      hrefURL: col.permalink_url,
      cover: fixedSoundCloudCoverSize(col.artwork_url),
      audioURL: `/api/fetchSoundCloudAudio?urn=${encodeURIComponent(col.urn)}`,
      artist: col.user.username,
    } satisfies Song));
  }

  /**
   * Fetches a song from Apple Music API using its ISRC.
   * @param isrc the ISRC to look for.
   * @returns A promise that resolves to a JSON song object or null if not found.
   */
  private async songByISRC(isrc: string): Promise<Response> {
    if (!this.axiosClient) {
      this.axiosClient = await getAuthenticatedAxios(new AppleMusicConfig({
        region: Region.US,
        authType: AuthType.Scraped,
      }));
    }

    try {
      const resp = await this.axiosClient
        .get(`https://amp-api-edge.music.apple.com/v1/catalog/us/songs?filter[isrc]=${encodeURIComponent(isrc)}`);

      if (resp.data) {
        const songsResponse = resp.data as SongsEndpointTypes.SongsResponse;
        const data = songsResponse.data;

        if (data) {
          for (const s of songsResponse.data) {
            if (s.attributes.name && (s.attributes.previews?.length ?? 0) > 0) {
              return Response.json({
                name: s.attributes.name,
                artist: s.attributes.artistName ?? "Unknown",
                hrefURL: s.attributes.url ?? "https://music.apple.com/us/",
                cover: fixedAppleMusicCoverSize(s.attributes.artwork?.url),
                audioURL: s.attributes.previews!.find(p => appleMusicPreviewRegex.test(p.url))!.url,
              } satisfies Song);
            }
          }
        }
      }
    } catch { }
    return Response.json(null);
  }

  /**
   * Fetches playlist information from an Apple Music URL.
   *
   * @param url The Apple Music URL of the playlist.
   * @returns A Promise resolving to the Playlist information.
   */
  private async getPlaylistInfo(url: string): Promise<Playlist> {
    if (!artistRegex.test(url) && !albumRegex.test(url) && !songRegex.test(url)) {
      return DefaultPlaylist;
    }

    const page = await fetch(url);
    const text = await page.text();

    // get content of schema.org tag <script id=schema:music-[...] type="application/ld+json">
    // eslint-disable-next-line regexp/no-unused-capturing-group, regexp/no-misleading-capturing-group
    const regex = /<script\s+id="?schema:(Music[^"]*|song)"?\s+type="?application\/ld\+json"?\s*>(?<json>[\s\S]*?)<\/script>/i;
    const match = regex.exec(text);
    if (!match || !match.groups || !match.groups.json) {
      return DefaultPlaylist;
    }
    const json = match.groups.json;

    try {
      const data = JSON.parse(json);
      const name: string = data.name ?? url;
      const cover: string | null = fixedAppleMusicCoverSize(data.image ?? null);
      let songs: Song[] = [];

      // album always provides tracks
      if (data["@type"] === "MusicAlbum" && data.tracks) {
        const artist: string = data?.byArtist?.[0]?.name ?? "Unknown Artist";

        songs = data.tracks.map((e: any) => (
          e?.audio?.contentUrl
            ? {
              name: e.audio.name ?? "Unknown Song",
              artist,
              audioURL: e.audio.contentUrl,
              hrefURL: e.url ?? DefaultPlaylist.hrefURL,
              cover: (e.audio.thumbnailUrl || e.thumbnailUrl) ?? null,
            } satisfies Song
            : undefined
        )).filter((e: any) => e);
      }

      return {
        name,
        hrefURL: url,
        cover,
        songs,
      };
    } catch {
      return DefaultPlaylist;
    }
  }

  /**
   * Generates a unique 6-character room ID that does not currently exist.
   *
   * @returns A Promise that resolves with the unique 6-character room ID, or `null` if a unique ID couldn't be found after 100 attempts.
   */
  private async generateRoomID(): Promise<string | null> {
    let roomID: string = "";
    const possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i: number = 0; i < 6; i++) {
        roomID += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      try {
        const stub = env.SongGuessServer.getByName(roomID);

        // room already exists
        if (!(await stub.isValidRoom())) {
          return roomID;
        }
      } catch (e) {
        console.error(`Error checking if room ${roomID} already is validated:`, e);
      }
    }

    return null;
  }

  /**
   * Creates a new SongGuessServer Durable Object by generating a unique ID and then returning the room data.
   *
   * @returns A Promise that resolves with a standard `Response` object.
   * - Status 201 (Created) with the room ID as the body on success.
   * - Status 409 (Conflict) if no free room ID could be generated.
   * - Status 500 (Internal Server Error) on room validation failure.
   */
  private async createNewRoom(): Promise<Response> {
    const roomID = await this.generateRoomID();
    let errorMessage = "";
    let statusCode = 201;

    if (roomID) {
      try {
        const stub = env.SongGuessServer.getByName(roomID);
        await stub.createValidRoom();
      } catch (e) {
        console.error(`Error validating room ${roomID}:`, e);
        errorMessage = "Can't validate room.";
        statusCode = 500;
      }
    } else {
      console.warn("Can't find a free room id.");
      errorMessage = "Can't find a free room id.";
      statusCode = 409;
    }

    return Response.json({
      roomID: roomID as string,
      error: errorMessage,
    } satisfies CreateRoomResponse, { status: statusCode });
  }

  /**
   * Caches a fetch response asynchronously while streaming the body content directly to the client.
   * Also prevents redundant fetches during concurrent requests
   *
   * @param url - The target URL key for the Cache API storage.
   * @param fetchFunction - An asynchronous supplier returning the underlying network Response.
   * @returns A Promise resolving to a Response object suitable for immediate streaming.
   */
  /**
   * Caches a fetch response asynchronously while streaming the body content directly to the client.
   *
   * @param url - The target URL key for the Cache API storage.
   * @param fetchFunction - An asynchronous supplier returning the underlying network Response.
   * @returns A Promise resolving to a Response object suitable for immediate streaming.
   */
  private async cacheResponse(url: URL, fetchFunction: () => Promise<Response>): Promise<Response> {
    const key = url.toString();
    const cache = await caches.open("default");
    const cachedResponse = await cache.match(key);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Coalesce in-flight requests by teeing the existing unconsumed stream branch
    if (this.inFlightRequests.has(key)) {
      const entry = await this.inFlightRequests.get(key)!;
      const [streamForClient, streamToKeep] = entry.stream.tee();

      // Update the stored entry stream branch for any subsequent listeners
      entry.stream = streamToKeep;

      return new Response(streamForClient, {
        status: entry.status,
        statusText: entry.statusText,
        headers: new Headers(entry.headers),
      });
    }

    const executionPromise = (async (): Promise<InFlightEntry> => {
      try {
        const originalResponse = await fetchFunction();

        if (!originalResponse.ok || !originalResponse.body) {
          // noinspection ExceptionCaughtLocallyJS
          throw new Error(`Upstream fetch failed with status ${originalResponse.status}`);
        }

        const headers = new Headers(originalResponse.headers);
        headers.set("Cache-Control", "public, max-age=7200");
        headers.delete("Age");
        headers.delete("Set-Cookie");

        // Split initial stream into cache stream and response stream
        const [streamForCache, streamForResponse] = originalResponse.body.tee();

        const responseToCache = new Response(streamForCache, {
          status: originalResponse.status,
          statusText: originalResponse.statusText,
          headers,
        });

        // Background cache save
        const cachePromise = cache.put(key, responseToCache)
          .catch(() => {})
          .finally(() => {
            this.inFlightRequests.delete(key);
          });

        this.ctx.waitUntil(cachePromise);

        return {
          headers,
          status: originalResponse.status,
          statusText: originalResponse.statusText,
          stream: streamForResponse,
        };
      } catch (error) {
        this.inFlightRequests.delete(key);
        throw error;
      }
    })();

    this.inFlightRequests.set(key, executionPromise);

    try {
      const entry = await executionPromise;
      const [streamForClient, streamToKeep] = entry.stream.tee();
      entry.stream = streamToKeep;

      return new Response(streamForClient, {
        status: entry.status,
        statusText: entry.statusText,
        headers: new Headers(entry.headers),
      });
    } catch {
      // Fallback if initial fetch execution fails
      return fetchFunction();
    }
  }

  /**
   * Handles HTTP request to the room's endpoint.
   */
  async onRequest(req: Request): Promise<Response> {
    const url: URL = new URL(req.url);

    switch (url.pathname.split("/").pop()) {
      case "createRoom":
        return this.createNewRoom();

      case "playlistInfo": {
        // fetch playlist info
        const playlistURL = url.searchParams.get("url");
        if (!playlistURL) {
          return new Response("Missing url parameter.", { status: 400 });
        }

        // return Response.json(await this.getPlaylistInfo(playlistURL));
        return this.cacheResponse(url, async () => Response.json(await this.getPlaylistInfo(playlistURL)));
      }

      case "songByISRC": {
        const isrc = url.searchParams.get("isrc");
        if (!isrc) {
          return new Response("Missing isrc parameter.", { status: 400 });
        }

        // return this.songByISRC(isrc);
        return this.cacheResponse(url, () => this.songByISRC(isrc));
      }

      case "searchSoundCloud": {
        if (!this.soundCloud.isEnabled) {
          // this will send the error response
          return this.soundCloud.fetchGet("dummy");
        }

        const query = url.searchParams.get("q");
        if (!query) {
          return new Response("Missing q (query) parameter.", { status: 400 });
        }

        // return Response.json(await this.searchSoundCloud(query));
        return this.cacheResponse(url, async () => Response.json(await this.searchSoundCloud(query)));
      }

      case "fetchSoundCloudAudio": {
        if (!this.soundCloud.isEnabled) {
          // this will send the error response
          return this.soundCloud.fetchGet("dummy");
        }

        const urn = url.searchParams.get("urn");
        if (!urn) {
          return new Response("Missing urn parameter.", { status: 400 });
        }

        // return this.fetchSoundCloudAudio(urn);
        return this.cacheResponse(url, () => this.fetchSoundCloudAudio(urn));
      }

      case "searchYT": {
        if (typeof env.YATTEE_SERVER === "string" && env.YATTEE_SERVER.trim().length === 0) {
          return new Response("YT API is disabled", { status: 403 });
        }

        const query = url.searchParams.get("q");
        if (!query) {
          return new Response("Missing q (query) parameter.", { status: 400 });
        }

        // return this.searchYT(query);
        return this.cacheResponse(url, () => this.searchYT(query));
      }

      case "fetchYTAudio": {
        if (typeof env.YATTEE_SERVER === "string" && env.YATTEE_SERVER.trim().length === 0) {
          return new Response("YT API is disabled", { status: 403 });
        }

        const videoId = url.searchParams.get("v");
        if (!videoId) {
          return new Response("Missing video identifier.", { status: 400 });
        }

        // return this.fetchYTAudio(videoId);
        return this.cacheResponse(url, () => this.fetchYTAudio(videoId));
      }

      default:
        return new Response("Bad request.\n\n"
          + "Supported enpoints:\n"
          + "/api/createRoom\n"
          + "/api/playlistInfo?url={Apple Music URL}\n"
          + "/api/songByISRC?isrc={International Standard Recording Code}\n"
          + "/api/searchSoundCloud?q={search term}\n"
          + "/api/fetchSoundCloudAudio?urn={SoundCloud track URN}", { status: 400 });
    }
  }
}
