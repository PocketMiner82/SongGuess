import type * as Party from "partykit/server";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";
import z from "zod";
import { fetchGetRoom, fetchPostRoom } from "../RoomHTTPHelper";
import { ClientMessageSchema, type Song } from "../schemas/RoomClientMessageSchemas";
import type { RoomInfoResponse, PostCreateRoomResponse } from "../schemas/RoomHTTPSchemas";
import { type GameState, type PlayerState, type UpdateMessage, type ServerUpdatePlaylistMessage, type AudioControlMessage } from "../schemas/RoomServerMessageSchemas";
import { type Playlist, type GeneralErrorMessage, COLORS } from "../schemas/RoomSharedMessageSchemas";


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

  /**
   * Currently selected playlist(s)
   */
  playlists: Playlist[] = [];

  /**
   * Songs of the currently selected playlist(s)
   */
  songs: Song[] = [];


  constructor(readonly room: Party.Room) {}

  //
  // ROOM WS EVENTS
  //

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    this.log(`${conn.id} connected.`);

    // kick player if room is not created yet
    if (!this.isValidRoom) {
      conn.close(4000, "Room ID not found");
      return;
    }

    // also kick if room is already ingame
    if (this.state !== "lobby") {
      conn.close(4001, "Game is already running");
      return;
    }

    // first player connected, this must be the host
    if (this.getOnlineCount() === 1) {
      this.hostConnection = conn;
    }

    if (!this.initConnection(conn)) {
      conn.close(4002, "Room is full.");
      return;
    }

    // send the first update to the connection (and inform all other connections about the new player)
    this.broadcastUpdateMessage();
  }

  onMessage(message: string, conn: Party.Connection) {
    // ignore all messages if room is not valid
    if (!this.isValidRoom) {
      return;
    }

    this.log(`${conn.id} sent: ${message}`, "debug");

    // try to parse json
    try {
      var json = JSON.parse(message);
    } catch {
      this.sendError(conn, "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.log(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`, "warn");
      this.sendError(conn, `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    let msg = result.data;

    // handle each message type
    switch(msg.type) {
      case "error":
        this.log(`Client ${conn.id} reported an error:\n${msg.error_message}`, "warn");
        break;
      case "change_username":
        if (this.state !== "lobby") {
          conn.send(this.getUpdateMessage(conn, "not_in_lobby"));
          return;
        }

        // username is already validated
        (conn.state as PlayerState).username = msg.username;

        // this not only informs all other users about the name change but also the tells the connection
        // that the name change was successfuls
        this.broadcastUpdateMessage();
        break;
      case "host_update_playlists":
        if (this.hostConnection !== conn) {
          conn.send(this.getPlaylistUpdateMessage("not_host"));
          return;
        } else if (this.state !== "lobby") {
          conn.send(this.getPlaylistUpdateMessage("not_in_lobby"));
          return;
        }

        this.playlists = msg.playlists;
        this.songs = msg.songs;

        // send the update to all players, including sender (for confirmation)
        this.room.broadcast(this.getPlaylistUpdateMessage());

        // test playback
        if (this.songs[0]) {
          this.room.broadcast(this.getAudioControlMessage("load", this.songs[0].audioURL));
          setTimeout(() => this.room.broadcast(this.getAudioControlMessage("play")), 5000);
        }
        break;
      default:
        this.sendError(conn, `Invalid message type: ${msg.type}`);
        break;
    }
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

    // no more players left
    if (this.getOnlineCount() === 0) {
      this.hostConnection = null;
      this.delayedCleanup();

      this.log("Last client left, room will close in 5 seconds if no one joins...");
    } else {
      // inform all clients about changes, including possible host transfer
      this.broadcastUpdateMessage();
    }
  }

  //
  // NORMAL FUNCTIONS
  //

  /**
   * Invalidates the room if no players join within 5 seconds.
   */
  private delayedCleanup() {
    setTimeout(() => {
      if (this.getOnlineCount() === 0) {
        this.isValidRoom = false;
        this.log("Room closed due to timeout.");
      }
    }, 5000);
  }

  /**
   * Logs a message with the {@link LOG_PREFIX}
   * 
   * @param text 
   */
  private log(text: string, level: "debug"|"warn"|"error"|"info" = "info") {
    let logFunction: (...data: any) => void;
    switch(level) {
      case "debug":
        logFunction = console.debug;
        break;
      case "warn":
        logFunction = console.error;
        break;
      case "error":
        logFunction = console.error;
        break;
      case "info":
      default:
        logFunction = console.info;
        break;
    }

    logFunction(`${this.LOG_PREFIX} ${text}`);
  }

  /**
   * Calculates the current number of active WebSocket connections in the room.
   *
   * @returns The count of connected clients.
   */
  private getOnlineCount(): number {
    return Array.from(this.room.getConnections()).length;
  }

  /**
   * Get all usernames and there associated color
   * 
   * @returns A map containing the username as keys and their color as values
   */
  private getUsernamesWithColors(): PlayerState[] {
    let states: PlayerState[] = [];
    for (let connection of this.room.getConnections()) {
      let state = connection.state as PlayerState;

      if (state && state.username && state.color) {
        states.push(state);
      }
    }

    return states;
  }

  /**
   * Get all colors, which aren't used by any player
   * 
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  private getUnusedColors(): string[] {
    let usedColors = this.getUsernamesWithColors().map(item => item.color);

    return COLORS.filter(item => usedColors.indexOf(item) < 0);
  }

  /**
   * Set initial random username and unused color for a player.
   * 
   * @param conn The connection of the player
   * @returns whether the init was successful (room was not full)
   */
  private initConnection(conn: Party.Connection): boolean {
    let username = uniqueUsernameGenerator({
      dictionaries: [adjectives, nouns],
      style: "titleCase",
      length: 15
    });

    let color = this.getUnusedColors()[0];

    if (!color) {
      return false;
    }

    let connState: PlayerState = {
      username: username,
      color: color
    };

    conn.setState(connState);

    // send the current playlist to the connection
    conn.send(this.getPlaylistUpdateMessage());

    return true;
  }

  /**
   * Sends a general error message and an update to a player.
   * 
   * @param conn The connection of the player that should receive the messages
   * @param error A description of the errors
   * @see {@link sendUpdate}
   */
  private sendError(conn: Party.Connection, error: string) {
    let resp: GeneralErrorMessage = {
      type: "error",
      error_message: error
    }
    conn.send(JSON.stringify(resp));
    conn.send(this.getUpdateMessage(conn));
  }

  /**
   * Constructs an update message with the current room/connection states to the connection.
   * 
   * @param conn the connection to send the update to
   * @param error if this update was the result of an error, this specifies the reason
   * @returns a JSON string of the constructed {@link UpdateMessage}
   */
  private getUpdateMessage(conn: Party.Connection, error?: UpdateMessage["error"]): string {
    let connState = conn.state as PlayerState;

    let msg: UpdateMessage = {
      type: "update",
      state: this.state,
      players: this.getUsernamesWithColors(),
      username: connState.username,
      color: connState.color,
      isHost: conn === this.hostConnection,
      error: error
    };

    return JSON.stringify(msg);
  }

  /**
   * Broadcast an update to all connected clients.
   * 
   * @see {@link sendUpdate}
   */
  private broadcastUpdateMessage() {
    for (const conn of this.room.getConnections()) {
      conn.send(this.getUpdateMessage(conn));
    }
  }

  /**
   * Constructs a playlist update message with the current playlist array.
   * 
   * @param error if this update was the result of an error, this specifies the reason
   * @returns a JSON string of the constructed {@link ServerUpdatePlaylistMessage}
   */
  private getPlaylistUpdateMessage(error?: ServerUpdatePlaylistMessage["error"]): string {
    let update: ServerUpdatePlaylistMessage = {
      type: "server_update_playlists",
      playlists: this.playlists,
      error: error
    };

    return JSON.stringify(update);
  }

  /**
   * Constructs an audio control load message.
   * 
   * @param action must be "load" for a load message.
   * @param audioURL an {@link Song["audioURL"]} to a music file that the client should pre-load.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  private getAudioControlMessage(action: "load", audioURL?: Song["audioURL"]): string;
  /**
   * Constructs an audio control message.
   * 
   * @param action the {@link AudioControlMessage["action"]} that should be performed.
   * @param audioURL can only be provided for load action.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  private getAudioControlMessage(action: Exclude<AudioControlMessage["action"], "load">, audioURL?: never): string;
  private getAudioControlMessage(action: AudioControlMessage["action"], audioURL?: Song["audioURL"]): string {
    let msg: AudioControlMessage;

    if (action === "load") {
      // load requires an audio URL
      msg = {
        type: "audio_control",
        action: "load",
        audioURL: audioURL!
      };
    } else {
      msg = {
        type: "audio_control",
        action: action
      };
    }

    return JSON.stringify(msg);
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
        this.delayedCleanup();

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
   * @param origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @returns A Promise that resolves with the unique 6-character room ID, or `null` if a unique ID couldn't be found after 100 attempts.
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
   * @param origin The base URL or origin of the server (e.g., 'http://localhost:3000').
   * @param token The initial authentication token to associate with the new room.
   * @returns A Promise that resolves with a standard `Response` object.
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
