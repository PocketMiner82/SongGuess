import type { SongsEndpointTypes } from "@syncfm/applemusic-api";
import type { AxiosInstance } from "axios";
import type { SoundcloudTrack } from "soundcloud.ts";
import type { CreateRoomResponse } from "../../types/APIResponseTypes";
import type { Playlist, Song } from "../../types/MessageTypes";
import type { SoundCloudStreams } from "./SoundCloudAPI";
import { AppleMusicConfig, AuthType, getAuthenticatedAxios, Region } from "@syncfm/applemusic-api";
import { env } from "cloudflare:workers";
import { Server } from "partyserver";
import { albumRegex, appleMusicPreviewRegex, artistRegex, songRegex } from "../../schemas/ValidationRegexes";
import { fixedCoverSize } from "../../shared/Utils";
import { DefaultPlaylist } from "../../types/MessageTypes";
import { SoundCloudAPI } from "./SoundCloudAPI";

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
   * Returns the current {@link this.ctx}
   */
  public getCtx() {
    return this.ctx;
  }

  private async fetchSoundCloudAudio(urn: string): Promise<Response> {
    const streams: SoundCloudStreams = await this.soundCloud.fetchGetJson(`/tracks/${urn}/streams`);

    if (streams.http_mp3_128_url) {
      const resp = await this.soundCloud.fetchGet(streams.http_mp3_128_url);
      if (resp.ok) {
        return resp;
      }
    }

    const resp = await this.soundCloud.fetchGet(`/tracks/${urn}/preview`);
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
      cover: col.artwork_url,
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
                cover: fixedCoverSize(s.attributes.artwork?.url),
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
      const cover: string | null = fixedCoverSize(data.image ?? null);
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
   * Handles HTTP request to the room's endpoint.
   */
  async onRequest(req: Request): Promise<Response> {
    const url: URL = new URL(req.url);

    switch (url.pathname.split("/").pop()) {
      case "createRoom":
        return await this.createNewRoom();

      case "playlistInfo": {
        // fetch playlist info
        const playlistURL = url.searchParams.get("url");
        if (!playlistURL) {
          return new Response("Missing url parameter.", { status: 400 });
        }

        return Response.json(await this.getPlaylistInfo(playlistURL));
      }

      case "songByISRC": {
        const isrc = url.searchParams.get("isrc");
        if (!isrc) {
          return new Response("Missing isrc parameter.", { status: 400 });
        }

        return this.songByISRC(isrc);
      }

      case "searchSoundCloud": {
        const query = url.searchParams.get("q");
        if (!query) {
          return new Response("Missing q (query) parameter.", { status: 400 });
        }

        return Response.json(await this.searchSoundCloud(query));
      }

      case "fetchSoundCloudAudio": {
        const urn = url.searchParams.get("urn");
        if (!urn) {
          return new Response("Missing urn parameter.", { status: 400 });
        }

        const cache = await caches.open("default");
        let resp = await cache.match(url.toString());

        if (!resp) {
          const originalResponse = await this.fetchSoundCloudAudio(urn);
          const headers = new Headers(originalResponse.headers);

          headers.set("Cache-Control", "public, max-age=7200");
          headers.delete("Age");
          headers.delete("Set-Cookie");

          resp = new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers,
          });
          await cache.put(url.toString(), resp.clone());
        }

        return resp;
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
