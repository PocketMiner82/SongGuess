import type * as Party from "partykit/server";
import { fetchGetRoom, fetchPostRoom, type RoomInfoResponse } from "../RoomRequests";

export default class Server implements Party.Server {
  /**
   * True, if this room was created by a request to /createRoom
   */
  isValidRoom: boolean = false;

  /**
   * This is the websocket connection of the host.
   * If the host leaves, the room will close.
   * A host can:
   *  - Start the game
   *  - Select a playlist
   *  - Kick players
   */
  hostConnection: Party.Connection|null = null;

  /**
   * Log messages are prefixed with this string.
   */
  LOG_PREFIX: string = `[Room ${this.room.id}]`;


  constructor(readonly room: Party.Room) {}

  //
  // ROOM WS
  //

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // first player connected, this must be the host
    if (this.getOnlineCount() === 1) {
      this.hostConnection = conn;
    }

    // A websocket just connected!
    this.log(`${conn.id} connected.`);

    // let's send a message to the connection
    conn.send("hello from server");
  }

  onMessage(message: string, sender: Party.Connection) {
    // let's log the message
    this.log(`${sender.id} sent message: ${message}`);
    // as well as broadcast it to all the other connections in the room except for the connection it came from
    this.room.broadcast(`${sender.id}: ${message}`, [sender.id]);
  }

  onClose(connection: Party.Connection) {
    this.log(`${connection.id} left.`);

    // host left, close room
    if (this.hostConnection === connection) {
      this.log("Host left, closing room...");
      for (const conn of this.room.getConnections()) {
        conn.close(4000, "Host left room");
      }
    }

    // no more players left, cleanup the room
    if (this.getOnlineCount() === 0) {
      this.hostConnection = null;
      this.isValidRoom = false;

      this.log("Room closed.");
    }
  }

  //
  // NORMAL FUNCTIONS
  //

  private log(text: string) {
    console.log(`${this.LOG_PREFIX} ${text}`);
  }

  /**
   * Calculates and returns the current number of active WebSocket connections in the room.
   *
   * @private
   * @returns {number} The count of connected clients.
   */
  private getOnlineCount(): number {
    return Array.from(this.room.getConnections()).length;
  }

  //
  // ROOM HTTP EVENTS
  //

  async onRequest(req: Party.Request): Promise<Response> {
    let url: URL = new URL(req.url);

    // handle room creation
    if (url.pathname.endsWith("/createRoom")) {
      return await Server.createNewRoom(new URL(req.url).origin, this.room.env.VALIDATE_ROOM_TOKEN as string);
    // respond with JSON containing the current online count and if the room is valid
    } else if (req.method === "GET") {
      let json: RoomInfoResponse = {
        onlineCount: this.getOnlineCount(),
        isValidRoom: this.isValidRoom
      };

      return Response.json(json);
    // used to initially validate and activate the room, requires a secret token shared between this method and the static createRoom method
    } else if (req.method === "POST") {
      let url = new URL(req.url);
      if (url.searchParams.has("token") && url.searchParams.get("token") === this.room.env.VALIDATE_ROOM_TOKEN) {
        this.isValidRoom = true;

        // if no one joins within 5 seconds, invalidate the room number again
        setTimeout(() => {
          if (this.getOnlineCount() === 0) {
            this.isValidRoom = false;
            this.log("Room closed due to timeout.");
          }
        }, 5000);

        this.log("Room created.");
        return new Response("ok", { status: 200 });
      }

      return new Response("Token invalid/missing.", { status: 401 });
    }

    return new Response("Bad request", { status: 400 });
  }

  //
  // STATIC ROOM WS CONNECT EVENT
  //

  static async onBeforeConnect(req: Party.Request, lobby: Party.Lobby, ctx: Party.ExecutionContext) {
    let roomInfo = await fetchGetRoom(req.url);

    // deny access if room does not exist
    if (!roomInfo || !roomInfo.isValidRoom) {
      return new Response("Room does not exist", {status: 401});
    }

    return req;
  }

  //
  // STATIC GLOBAL FETCH EVENTS
  //

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, ctx: Party.ExecutionContext) {
    let url: URL = new URL(req.url);

    // if room url is requested without html extension, add it
    if (url.pathname === "/room") {
      return lobby.assets.fetch("/room.html" + url.search);
    }

    // redirect to main page, if on another one
    return Response.redirect(url.origin);
  }

  //
  // STATIC FUNCTIONS
  //

  /**
   * Generates a unique 6-character room ID that does not currently exist on the server.
   *
   * It attempts to generate a random ID and checks for its existence up to 100 times.
   * The possible characters for the ID are alphanumeric (A-Z, a-z, 0-9).
   *
   * @private
   * @static
   * @param {string} origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @returns {Promise<string | null>} A Promise that resolves with the unique 6-character room ID, or `null` if a unique ID couldn't be found after 100 attempts.
   */
  private static async generateRoomID(origin: string): Promise<string | null> {
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
   * @private
   * @static
   * @param {string} origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @param {string} token The initial authentication token to associate with the new room.
   * @returns {Promise<Response>} A Promise that resolves with a standard `Response` object.
   * - Status 201 (Created) with the room ID as the body on success.
   * - Status 409 (Conflict) on failure.
   * - Status 500 (Internal Server Error) on room validation failure.
   */
  private static async createNewRoom(origin: string, token: string): Promise<Response> {
    let roomID = await Server.generateRoomID(origin);

    if (roomID) {
      if(!await fetchPostRoom(`${origin}/parties/main/${roomID}`, token)) {
        return new Response("Can't validate room.", {status: 500});
      }
    }
    
    return roomID == null ? new Response("Can't find a free room id.", {status: 409}) : new Response(roomID, {status: 201});
  }
}

Server satisfies Party.Worker;
