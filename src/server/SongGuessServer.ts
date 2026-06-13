import type { Connection, ConnectionContext } from "partyserver";
import type { RoomGetResponse } from "../types/APIResponseTypes";
import type { ServerMessage } from "../types/MessageTypes";
import type { PersistedRoomState } from "../types/PersistedStateTypes";
import { Server } from "partyserver";
import { ROOM_CLEANUP_TIMEOUT } from "../shared/ConfigConstants";
import Logger from "./logger/Logger";
import { ValidRoom } from "./ValidRoom";


export default class SongGuessServer extends Server<Env> {
  static options = { hibernate: false };

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
  cleanupTimeout: NodeJS.Timeout | null = null;

  /**
   * The interval that ticks the room every second.
   */
  tickInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new room server.
   */
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.logger = new Logger(this);

    ctx.blockConcurrencyWhile(async () => await this.restoreState(ctx)).catch(this.logger.error);
  }

  /**
   * Saves relevant state of the room to storage.
   */
  async saveState() {
    if (!this.validRoom) {
      await this.ctx.storage.delete("state");
      return;
    }

    const state: PersistedRoomState = this.validRoom.toStorage();
    console.debug(state);
    // await this.ctx.storage.put("state", state);
  }

  /**
   * Restores the state of the room, e.g. when the Durable Object gets restarted.
   */
  async restoreState(ctx: DurableObjectState = this.ctx) {
    const state = await ctx.storage.get<PersistedRoomState>("state");
    if (!state) {
      // the room is not valid, nothing to do
      return;
    }

    this.logger.info("Restoring state...");
    // this.validRoom = ValidRoom.fromStorage(this, state);
  }

  /**
   * Creates a ValidRoom instance, allowing players to connect to this room.
   */
  public createValidRoom() {
    this.validRoom = new ValidRoom(this);
    this.delayedCleanup();

    this.logger.info("Room created.");
    this.saveState().catch(this.logger.error);
  }

  /**
   * Returns whether this room is valid or not.
   */
  public isValidRoom(): boolean {
    return this.validRoom !== undefined;
  }

  /**
   * Calculates the current number of active WebSocket connections in the room.
   *
   * @returns The count of connected clients.
   */
  public getOnlinePlayersCount(): number {
    let count = 0;
    for (const _connection of this.getActiveConnections("player")) {
      count++;
    }
    return count;
  }

  /**
   * Invalidates the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   * Uses milliseconds for the setTimeout function (ROOM_CLEANUP_TIMEOUT * 1000).
   */
  private delayedCleanup() {
    this.cleanupTimeout = setTimeout(async () => {
      try {
        if (this.getOnlinePlayersCount() === 0) {
          clearInterval(this.tickInterval!);
          this.tickInterval = null;

          this.validRoom = undefined;
          await this.saveState();

          this.logger.info("Room closed due to timeout.");
        }
        this.cleanupTimeout = null;
      } catch (e) {
        this.logger.error("Error running cleanup timeout:");
        this.logger.error(e);
      }
    }, ROOM_CLEANUP_TIMEOUT * 1000);
  }

  /**
   * Broadcasts a message to all connected clients, optionally filtered by a specific tag.
   *
   * @param msg The message object to be broadcasted to the connections.
   * @param tag An optional filter to target a specific subset of connections.
   */
  public safeBroadcast(msg: ServerMessage, tag?: string) {
    if (msg.type !== "add_log_message" && msg.type !== "update_log_messages"
      && msg.type !== "ping" && msg.type !== "pong") {
      this.logger.debug(`Broadcast: ${JSON.stringify(msg)}`);
    }

    for (const conn of this.getActiveConnections(tag)) {
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
  public safeSend(conn: Connection<string>, msg: ServerMessage, log: boolean = true) {
    try {
      // silently ignore if not open
      if (conn.readyState === WebSocket.OPEN) {
        const textMsg = JSON.stringify(msg);
        conn.send(textMsg);

        if (log && msg.type !== "add_log_message" && msg.type !== "update_log_messages"
          && msg.type !== "ping" && msg.type !== "pong") {
          this.logger.debug(`To ${conn.state}: ${textMsg}`);
        }
      }
    } catch (e) {
      this.logger.error(`Failed to send ${msg.type} message to ${conn.state}:`);
      this.logger.error(e);
    }
  }

  /**
   * Returns a list of connections with OPEN state.
   *
   * @param tag An optional filter to target a specific subset of connections.
   */
  private* getActiveConnections(tag?: string): Iterable<Connection<string>> {
    for (const conn of this.getConnections<string>(tag)) {
      if (conn && conn.readyState === WebSocket.OPEN) {
        yield conn;
      }
    }
  }

  /**
   * Checks whether a connection has a specific connection tag assigned by {@link getConnectionTags}.
   * @param conn The connection to check.
   * @param tag The tag that should be present.
   * @returns whether the connection has the tag or not.
   */
  public hasTag(conn: Connection<string>, tag: string): boolean {
    for (const activeConn of this.getActiveConnections(tag)) {
      if (conn === activeConn) {
        return true;
      }
    }
    return false;
  }

  //
  // ROOM WS EVENTS
  //

  getConnectionTags(conn: Connection<string>, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const authParam = url.searchParams.get("auth");
    if (authParam) {
      const credentials = atob(authParam).split(":");

      if (conn.id.startsWith("admin_") && credentials.length === 2
        && credentials[0] === this.env.ADMIN_USER && credentials[1] === this.env.ADMIN_PASSWORD) {
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
  async onConnect(conn: Connection<string>, ctx: ConnectionContext) {
    if (this.hasTag(conn, "unauthorized")) {
      conn.close(4403, "Access denied.");
      return;
    }

    // connection state is id (and username later) used to print in logs
    conn.state = conn.id;

    // admin should not be registered "normally" to the room.
    if (this.hasTag(conn, "admin")) {
      this.logger.info(`Admin ${conn.state} connected.`);
      return;
    }

    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    // kick player if room is not created yet
    if (!this.validRoom) {
      conn.close(4000, "Room ID not found");
      this.logger.info(`${conn.state} tried connecting to non-validated room.`);
      return;
    }

    // start the tick interval
    if (!this.tickInterval) {
      this.tickInterval = setInterval(async () => {
        try {
          this.validRoom?.onTick();
          await this.saveState();
        } catch (e) {
          this.logger.error("Error running ValidRoom#onTick():");
          this.logger.error(e);
        }
      }, 1000);
    }

    this.logger.info(`${conn.state} connected.`);

    try {
      this.validRoom.onConnect(conn, ctx);
      await this.saveState();
    } catch (e) {
      this.logger.error("Error running ValidRoom#onConnect():");
      this.logger.error(e);
    }
  }

  /**
   * Handles incoming messages from a WebSocket connection.
   *
   * @param conn The connection that sent the message.
   * @param message The message content as a string.
   */
  async onMessage(conn: Connection<string>, message: string) {
    // ignore all messages if room is not valid
    if (!this.validRoom) {
      return;
    }

    try {
      this.validRoom.onMessage(conn, message);
      await this.saveState();
    } catch (e) {
      this.logger.error("Error running ValidRoom#onMessage():");
      this.logger.error(e);
    }
  }

  /**
   * Handles a WebSocket connection closing.
   *
   * @param conn The connection that closed.
   */
  async onClose(conn: Connection<string>) {
    if (this.hasTag(conn, "admin")) {
      this.logger.info(`Admin ${conn.state} left.`);
      return;
    }

    // ignore disconnects if room is not valid
    if (!this.validRoom) {
      return;
    }

    this.logger.info(`${conn.state} left.`);

    try {
      this.validRoom.onClose(conn);

      if (this.getOnlinePlayersCount() === 0) {
        this.delayedCleanup();

        this.logger.info(`Last client left, room will close in ${ROOM_CLEANUP_TIMEOUT} seconds if no one joins...`);
      }

      await this.saveState();
    } catch (e) {
      this.logger.error("Error running ValidRoom#onClose():");
      this.logger.error(e);
    }
  }

  /**
   * Handles errors for a connection.
   * Currently just logs them as warnings.
   *
   * @param conn the connection that had an error
   * @param error the error that occured
   */
  onError(conn: Connection<string>, error: unknown): void {
    this.logger.warn(`Error with connection ${conn.state}:`);
    this.logger.warn(error);
  }

  /**
   * Called when an exception occurs.
   *
   * @param error the error that occurred
   */
  onException(error: unknown): void {
    this.logger.error("Exception was thrown:");
    this.logger.error(error);
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
  async onRequest(req: Request): Promise<Response> {
    // respond with JSON containing the current online count and if the room is valid
    if (req.method === "GET") {
      const json: RoomGetResponse = {
        onlineCount: this.getOnlinePlayersCount(),
        isValidRoom: this.isValidRoom(),
      };

      return Response.json(json);
    }

    return new Response("Bad request. Only GET is supported.", { status: 400 });
  }
}
