import type * as Party from "partykit/server";
import { fetchGetRoom, fetchPostRoom, type PostCreateRoomResponse, type RoomInfoResponse } from "../RoomHTTPMessages";
import type { GameState, UpdateMessage } from "../RoomMessages";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";

type ConnectionState = {
  username: string,
  color: string
};

const COLORS = ["Red", "DarkGreen", "Blue", "Orange", "LawnGreen", "Black", "White", "Cyan"];

export default class Server implements Party.Server {
  /**
   * True, if this room was created by a request to /createRoom
   */
  isValidRoom: boolean = false;

  /**
   * Log messages are prefixed with this string.
   */
  LOG_PREFIX: string = `[Room ${this.room.id}]`;

  /**
   * The current state of the game.
   */
  state: GameState = "lobby";

  /**
   * This is the websocket connection of the host.
   * If the host leaves, the room will close.
   * A host can:
   *  - Start the game
   *  - Select a playlist
   *  - Kick players
   */
  hostConnection: Party.Connection|null = null;


  constructor(readonly room: Party.Room) {}

  //
  // ROOM WS EVENTS
  //

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // kick player if room is not created yet
    if (!this.isValidRoom) {
      conn.close(4000, "Room ID not found");
      return;
    }

    // also kick if room is already ingame
    if (this.state === "ingame") {
      conn.close(4001, "Game is already running");
      return;
    }

    // first player connected, this must be the host
    if (this.getOnlineCount() === 1) {
      this.hostConnection = conn;
    }

    this.log(`${conn.id} connected.`);

    this.initConnection(conn);

    // send the first update to the connection (and inform all other connections about the new player)
    this.broadcastUpdate();
  }

  onMessage(message: string, sender: Party.Connection) {
    // ignore all messages if room is not valid
    if (!this.isValidRoom) {
      return;
    }

    // let's log the message
    this.log(`${sender.id} sent message: ${message}`);
    // as well as broadcast it to all the other connections in the room except for the connection it came from
    this.room.broadcast(`${sender.id}: ${message}`, [sender.id]);
  }

  onClose(connection: Party.Connection) {
    // ignore disconnects if room is not valid
    if (!this.isValidRoom) {
      return;
    }

    this.log(`${connection.id} left.`);

    // host left, attempt to transfer host to another client
    if (this.hostConnection === connection) {
      let next = this.room.getConnections()[Symbol.iterator]().next();
      if (!next.done) {
        this.log(`Host left, transfering host to ${next.value.id}`);
        this.hostConnection = next.value;
      }
    }

    // no more players left, cleanup the room
    if (this.getOnlineCount() === 0) {
      this.hostConnection = null;
      this.isValidRoom = false;

      this.log("Last client left, room closed.");
    } else {
      // inform all clients about changes, including possible host transfer
      this.broadcastUpdate();
    }
  }

  //
  // NORMAL FUNCTIONS
  //

  /**
   * Logs a message with the {@link LOG_PREFIX}
   * 
   * @private
   * @param text 
   */
  private log(text: string) {
    console.log(`${this.LOG_PREFIX} ${text}`);
  }

  /**
   * Calculates the current number of active WebSocket connections in the room.
   *
   * @private
   * @returns The count of connected clients.
   */
  private getOnlineCount(): number {
    return Array.from(this.room.getConnections()).length;
  }

  /**
   * Get all usernames and there associated color
   * 
   * @private
   * @returns A map containing the username as keys and their color as values
   */
  private getUsernamesWithColors(): Map<string, string> {
    let map = new Map<string, string>();
    for (let connection of this.room.getConnections()) {
      let state = connection.state as ConnectionState;

      if (state && state.username && state.color) {
        map.set(state.username, state.color);
      }
    }

    return map;
  }

  /**
   * Get all colors, which aren't used by any player
   * 
   * @private
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  private getUnusedColors(): string[] {
    let usedColors = Array.from(this.getUsernamesWithColors().values());

    return COLORS.filter(item => usedColors.indexOf(item) < 0);
  }

  /**
   * Sends an {@link UpdateMessage} with the current room/connection states to the connection.
   * 
   * @private
   */
  private sendUpdate(conn: Party.Connection) {
    let connState = conn.state as ConnectionState;

    let update: UpdateMessage = {
      type: "update",
      state: this.state,
      players: Array.from(this.getUsernamesWithColors()),
      username: connState.username,
      color: connState.color,
      isHost: conn === this.hostConnection
    };

    conn.send(JSON.stringify(update));
  }

  /**
   * Broadcast an update to all connected clients.
   * 
   * @private
   * @see {@link sendUpdate}
   */
  private broadcastUpdate() {
    for (const conn of this.room.getConnections()) {
      this.sendUpdate(conn);
    }
  }

  /**
   * Set initial random username and unused color for the connection
   * 
   * @private
   */
  private initConnection(conn: Party.Connection) {
    let username = uniqueUsernameGenerator({
      dictionaries: [adjectives, nouns],
      style: "titleCase",
      length: 16
    });

    let color = this.getUnusedColors()[0];

    let connState: ConnectionState = {
      username: username,
      color: color
    };

    conn.setState(connState);
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

    let json: PostCreateRoomResponse = {
      roomID: roomID as string,
      error: errorMessage
    };
    
    return Response.json(json, {status: statusCode});
  }
}

Server satisfies Party.Worker;
