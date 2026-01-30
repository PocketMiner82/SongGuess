import type * as Party from "partykit/server";
import {clearInterval, clearTimeout} from "node:timers";
import {
  ROOM_CLEANUP_TIMEOUT
} from "../ConfigConstants";
import type {RoomGetResponse} from "../types/APIResponseTypes";
import {ValidRoom} from "./ValidRoom";
import Logger from "./logger/Logger";
import type {ServerMessage} from "../types/MessageTypes";


// noinspection JSUnusedGlobalSymbols
export default class Server implements Party.Server {
  /**
   * The main logger, logging messages to console and storage.
   */
  readonly logger: Logger;

  /**
   * Only set, if this room was created by a request to /createRoom
   */
  validRoom?: ValidRoom;

  /**
   * Timeout to clean up the room if no players join after {@link ROOM_CLEANUP_TIMEOUT} seconds.
   */
  cleanupTimeout: NodeJS.Timeout|null = null;

  /**
   * The interval that ticks the room every second.
   */
  tickInterval: NodeJS.Timeout|null = null;


  /**
   * Creates a new room server.
   *
   * @param partyRoom The room to serve
   */
  constructor(readonly partyRoom: Party.Room) {
    this.logger = new Logger(this);
  }

  /**
   * Calculates the current number of active WebSocket connections in the room.
   *
   * @returns The count of connected clients.
   */
  public getOnlinePlayersCount(): number {
    let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.getActiveConnections("player")) {
      count++;
    }
    return count;
  }

  /**
   * Invalidates the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   * Uses milliseconds for the setTimeout function (ROOM_CLEANUP_TIMEOUT * 1000).
   */
  private delayedCleanup() {
    this.cleanupTimeout = setTimeout(() => {
      if (this.getOnlinePlayersCount() === 0) {
        clearInterval(this.tickInterval!);
        this.tickInterval = null;

        this.validRoom = undefined;

        this.logger.info("Room closed due to timeout.");
      }
      this.cleanupTimeout = null;
    }, ROOM_CLEANUP_TIMEOUT * 1000);
  }

  /**
   * Broadcasts a message to all connected clients, optionally filtered by a specific tag.
   *
   * @param msg The message object to be broadcasted to the connections.
   * @param tag An optional filter to target a specific subset of connections.
   */
  public safeBroadcast(msg: ServerMessage, tag?: string) {
    if (msg.type !== "add_log_message" && msg.type !== "update_log_messages" &&
        msg.type !== "ping" && msg.type !== "pong") {
      this.logger.debug(`Broadcast: ${JSON.stringify(msg)}`);
    }

    for (let conn of this.getActiveConnections(tag)) {
      this.safeSend(conn, msg, false);
    }
  }

  /**
   * Safely sends a JSON-serialized message over a connection if it is currently open.
   *
   * @param conn The active party connection object used to send the data.
   * @param msg The message object to be stringified and transmitted to the client.
   * @param log Whether to log the sended message
   */
  public safeSend(conn: Party.Connection, msg: ServerMessage, log:boolean = true) {
    try {
      // silently ignore if not open
      if (conn.readyState === WebSocket.OPEN) {
        let textMsg = JSON.stringify(msg);
        conn.send(textMsg);

        if (log && msg.type !== "add_log_message" && msg.type !== "update_log_messages" &&
            msg.type !== "ping" && msg.type !== "pong") {
          this.logger.debug(`To ${conn.id}: ${textMsg}`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send ${msg.type} message to ${conn.id}:`);
      this.logger.error(e);
    }
  }

  /**
   * Returns a list of connections with OPEN state.
   *
   * @param tag An optional filter to target a specific subset of connections.
   */
  public *getActiveConnections(tag?: string): Iterable<Party.Connection> {
    for (const conn of this.partyRoom.getConnections(tag)) {
      if (conn && conn.readyState === WebSocket.OPEN) {
        yield conn;
      }
    }
  }

  //
  // ROOM WS EVENTS
  //

  getConnectionTags(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const authParam = url.searchParams.get("auth");
    if (authParam) {
      let credentials = atob(authParam).split(":");

      if (conn.id.startsWith("admin_") && credentials.length === 2 &&
          credentials[0] === this.partyRoom.env.ADMIN_USER && credentials[1] === this.partyRoom.env.ADMIN_PASSWORD) {
        return ["admin"];
      } else {
        return ["unauthorized"];
      }
    }
    return ["player"];
  }

  /**
   * Handles a new WebSocket connection to the room.
   *
   * @param conn The new connection.
   * @param ctx The connection context.
   */
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    if (this.getConnectionTags(conn, ctx).indexOf("unauthorized") !== -1) {
      conn.close(4403, "Access denied.");
      return;
    }

    // admin should not be registered "normally" to the room.
    if (this.getConnectionTags(conn, ctx).indexOf("admin") !== -1) {
      this.logger.getLogMessages().then(async loggerStorage => {
        if (loggerStorage) {
          this.safeSend(conn, {
            type: "update_log_messages",
            messages: loggerStorage
          });
        }

        this.logger.info(`Admin ${conn.id} connected.`);
      });

      return;
    }

    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // kick player if room is not created yet
    if (!this.validRoom) {
      conn.close(4000, "Room ID not found");
      this.logger.debug(`${conn.id} tried connecting to non-validated room.`);
      return;
    }

    // start the tick interval
    if (!this.tickInterval) {
      this.tickInterval = setInterval(() => {
        try {
          this.validRoom?.onTick();
        } catch (e) {
          this.logger.error("Error running onTick():");
          this.logger.error(e);
        }
      }, 1000);
    }

    this.logger.info(`${conn.id} connected.`);

    this.validRoom.onConnect(conn, ctx);
  }

  /**
   * Handles incoming messages from a WebSocket connection.
   *
   * @param message The message content as a string.
   * @param conn The connection that sent the message.
   */
  onMessage(message: string, conn: Party.Connection) {
    // ignore all messages if room is not valid
    if (!this.validRoom) {
      return;
    }

    this.validRoom.onMessage(message, conn);
  }

  /**
   * Handles a WebSocket connection closing.
   *
   * @param conn The connection that closed.
   */
  onClose(conn: Party.Connection) {
    if (conn.id.startsWith("admin_")) {
      this.logger.info(`Admin ${conn.id} left.`);
      return;
    }

    // ignore disconnects if room is not valid
    if (!this.validRoom) {
      return;
    }

    this.logger.info(`${conn.id} left.`);

    this.validRoom.onClose(conn);

    if (this.getOnlinePlayersCount() === 0) {
      this.delayedCleanup();

      this.logger.info(`Last client left, room will close in ${ROOM_CLEANUP_TIMEOUT} seconds if no one joins...`);
    }
  }

  //
  // ROOM HTTP EVENTS
  //

  /**
   * Handles HTTP requests to the room endpoint.
   *
   * @param req The HTTP request to handle.
   * @returns A Promise resolving to the HTTP response.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    // respond with JSON containing the current online count and if the room is valid
    if (req.method === "GET") {
      let json: RoomGetResponse = {
        onlineCount: this.getOnlinePlayersCount(),
        isValidRoom: this.validRoom !== undefined
      };

      return Response.json(json);
    // used to initially validate and activate the room, requires a secret token shared between this method and the static createRoom method
    } else if (req.method === "POST") {
      let url = new URL(req.url);
      if (url.searchParams.has("token") && url.searchParams.get("token") === this.partyRoom.env.VALIDATE_ROOM_TOKEN) {
        this.validRoom = new ValidRoom(this);
        this.delayedCleanup();

        this.logger.info("Room created.");
        return new Response("ok", { status: 200 });
      }

      return new Response("Token invalid/missing.", { status: 401 });
    }

    return new Response("Bad request. Only GET and POST is supported.", { status: 400 });
  }

  //
  // GLOBAL HTTP EVENTS
  //

  /**
   * Handles global HTTP requests to the PartyKit worker.
   *
   * @param req The fetch request.
   * @param lobby The fetch lobby for asset serving.
   * @param _ctx The execution context (unused).
   * @returns A Promise resolving to the fetch response.
   */
  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, _ctx: Party.ExecutionContext) {
    let url: URL = new URL(req.url);

    // if room url is requested without HTML extension, add it
    if (!url.pathname.endsWith(".html")) {
      let resp = await lobby.assets.fetch(`${url.pathname}.html${url.search}`);
      if (resp)
        return resp;
    }

    // redirect to main page, if on another one
    return Response.redirect(url.origin);
  }
}

// noinspection BadExpressionStatementJS
Server satisfies Party.Worker;
