import type * as Party from "partykit/server";
import {clearInterval, clearTimeout} from "node:timers";
import {
  ROOM_CLEANUP_TIMEOUT
} from "../ConfigConstants";
import type {RoomGetResponse} from "../types/APIResponseTypes";
import {ValidRoom} from "./ValidRoom";
import Logger from "./logger/Logger";
import type {UpdateLogMessages} from "../types/MessageTypes";


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
  public getOnlineCount(): number {
    return Array.from(this.partyRoom.getConnections("user")).length;
  }

  /**
   * Invalidates the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   * Uses milliseconds for the setTimeout function (ROOM_CLEANUP_TIMEOUT * 1000).
   */
  private delayedCleanup() {
    this.cleanupTimeout = setTimeout(() => {
      if (this.getOnlineCount() === 0) {
        clearInterval(this.tickInterval!);
        this.tickInterval = null;

        this.validRoom = undefined;

        this.logger.info("Room closed due to timeout.");
      }
      this.cleanupTimeout = null;
    }, ROOM_CLEANUP_TIMEOUT * 1000);
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
    return ["user"];
  }

  /**
   * Handles a new WebSocket connection to the room.
   *
   * @param conn The new connection.
   * @param ctx The connection context.
   */
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    if (this.getConnectionTags(conn, ctx).indexOf("unauthorized") !== -1) {
      conn.close(403, "Access denied.");
      return;
    }

    // admin should not be registered "normally" to the room.
    if (this.getConnectionTags(conn, ctx).indexOf("admin") !== -1) {
      this.logger.getLogMessages().then(async loggerStorage => {
        if (loggerStorage) {
          conn.send(JSON.stringify({
            type: "update_log_messages",
            messages: loggerStorage
          } satisfies UpdateLogMessages));
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

    if (this.getOnlineCount() === 0) {
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
        onlineCount: this.getOnlineCount(),
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
