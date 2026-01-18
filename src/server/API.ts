import type * as Party from "partykit/server";
import type {AxiosInstance} from "axios";
import {AppleMusicConfig, AuthType, getAuthenticatedAxios, Region, SongsEndpointTypes} from "@syncfm/applemusic-api";
import {fetchGetRoom, fetchPostRoom} from "../RoomHTTPHelper";
import type {CreateRoomResponse} from "../types/APIResponseTypes";
import {DefaultPlaylist, type Playlist, type Song} from "../types/MessageTypes";
import {albumRegex, appleMusicPreviewRegex, artistRegex, songRegex} from "../schemas/ValidationRegexes";
import {fixedCoverSize} from "../Utils";

/**
 * Handles API requests to the /parties/api/{endpoint} endpoints.
 */
export default class API implements Party.Server {
  /**
   * Client used for communication with Apple Music API.
   */
  axiosClient: AxiosInstance|null = null;

  constructor(readonly room: Party.Room) { }

  /**
   * Handles HTTP request to the room's endpoint.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    let url: URL = new URL(req.url);

    // handle room creation
    if (url.pathname.endsWith("/createRoom")) {
      return await this.createNewRoom(new URL(req.url).origin, this.room.env.VALIDATE_ROOM_TOKEN as string);
      // handle playlist info request
    } else if (url.pathname.endsWith("/playlistInfo")) {
      // fetch playlist info
      let playlistURL = url.searchParams.get("url");
      if (!playlistURL) {
        return new Response("Missing url parameter.", {status: 400});
      }

      return Response.json(await this.getPlaylistInfo(playlistURL));
    } else if(url.pathname.endsWith("/songByISRC")) {
      let isrc = url.searchParams.get("isrc");
      if (!isrc) {
        return new Response("Missing isrc parameter.", {status: 400});
      }

      return this.songByISRC(isrc);
    }

    // redirect to main page, if on another one
    return new Response("Bad request.\n\n" +
        "Supported enpoints:\n" +
        "/parties/api/createRoom\n" +
        "/parties/api/playlistInfo?url={Apple Music URL}\n" +
        "/parties/api/songByISRC?isrc={International Standard Recording Code}",
        { status: 400 });
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
        authType: AuthType.Scraped
      }));
    }

    try {
      let resp = await this.axiosClient
          .get("https://amp-api-edge.music.apple.com/v1/catalog/us/songs?filter[isrc]=" + encodeURIComponent(isrc));

      if (resp.data) {
        let songsResponse = resp.data as SongsEndpointTypes.SongsResponse;
        let data = songsResponse.data;

        if (data) {
          for (let s of songsResponse.data) {
            if (s.attributes.name && (s.attributes.previews?.length ?? 0) > 0) {
              return Response.json({
                name: s.attributes.name,
                artist: s.attributes.artistName ?? "Unknown",
                hrefURL: s.attributes.url ?? "https://music.apple.com/us/",
                cover: fixedCoverSize(s.attributes.artwork?.url),
                audioURL: s.attributes.previews!.find(p => appleMusicPreviewRegex.test(p.url))!.url
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

    let page = await fetch(url);
    let text = await page.text();

    // get content of schema.org tag <script id=schema:music-[...] type="application/ld+json">
    let regex = /<script\s+id="?schema:(Music[^"]*|song)"?\s+type="?application\/ld\+json"?\s*>(?<json>[\s\S]*?)<\/script>/i;
    let match = regex.exec(text);
    if (!match || !match.groups) {
      return DefaultPlaylist;
    }
    let json = match.groups["json"];

    try {
      let data = JSON.parse(json);
      let name: string = data.name ?? url;
      let cover: string|null = data.image ?? null;
      let songs: Song[] = [];

      // album always provides tracks
      if (data["@type"] === "MusicAlbum" && data.tracks) {
        let artist: string = data?.byArtist?.[0]?.name ?? "Unknown Artist";

        songs = data.tracks.map((e: any) => (
            e?.audio?.contentUrl ?
                {
                  name: e.audio.name ?? "Unknown Song",
                  artist: artist,
                  audioURL: e.audio.contentUrl,
                  hrefURL: e.url ?? DefaultPlaylist.hrefURL,
                  cover: (e.audio.thumbnailUrl || e.thumbnailUrl) ?? null
                } satisfies Song
                :
                undefined
        )).filter((e: any) => e);
      }

      return {
        name: name,
        hrefURL: url,
        cover: cover,
        songs: songs
      };
    } catch {
      return DefaultPlaylist;
    }
  }

  /**
   * Generates a unique 6-character room ID that does not currently exist on the server.
   *
   * It attempts to generate a random ID and checks for its existence up to 100 times.
   * The possible characters for the ID are alphanumeric (A-Z, a-z, 0-9).
   *
   * @param origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @returns A Promise that resolves with the unique 6-character room ID, or `null` if a unique ID couldn't be found after 100 attempts.
   */
  private async generateRoomID(origin: string): Promise<string | null> {
    let text: string = "";
    let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i: number = 0; i < 6; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      let roomInfo = await fetchGetRoom(`${origin}/parties/main/${text}`);

      // room already exists
      if (roomInfo && roomInfo.isValidRoom) {
        continue;
      }

      return text;
    }

    return null;
  }

  /**
   * Creates a new room on the server by generating a unique ID and then returning the room data.
   *
   * It first calls `generateRoomID` to get an available room ID. If an ID is successfully
   * generated, it sends a request to create the room with the provided token.
   *
   * @param origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @param token The initial authentication token to associate with the new room.
   * @returns A Promise that resolves with a standard `Response` object.
   * - Status 201 (Created) with the room ID as the body on success.
   * - Status 409 (Conflict) if no free room ID could be generated.
   * - Status 500 (Internal Server Error) on room validation failure.
   */
  private async createNewRoom(origin: string, token: string): Promise<Response> {
    let roomID = await this.generateRoomID(origin);
    let errorMessage = "";
    let statusCode = 201;

    if (roomID) {
      if(!await fetchPostRoom(`${origin}/parties/main/${roomID}`, token)) {
        errorMessage = "Can't validate room.";
        statusCode = 500;
      }
    } else {
      errorMessage = "Can't find a free room id.";
      statusCode = 409;
    }

    return Response.json({
      roomID: roomID as string,
      error: errorMessage
    } satisfies CreateRoomResponse, {status: statusCode});
  }
}

// noinspection BadExpressionStatementJS
API satisfies Party.Worker;