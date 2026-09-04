import type { Connection, ConnectionContext } from "partyserver";
import type { RoomGetResponse } from "../types/APIResponseTypes";
import type { ScheduledAlarmEvent } from "../types/DurableObjectAlarms";
import type { ServerMessage } from "../types/MessageTypes";
import type { PersistedServerState } from "../types/PersistedStateTypes";
import { clearInterval } from "node:timers";
import { Server } from "partyserver";
import { ROOM_CLEANUP_TIMEOUT, ROOM_HOST_TRANSFER_TIMEOUT } from "../shared/ConfigConstants";
import { PERSISTED_STATE_VERSION } from "../types/PersistedStateTypes";
import { Logger } from "./logger/Logger";
import { ValidRoom } from "./ValidRoom";


export class SongGuessServer extends Server<Env> {
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
   * The interval that ticks the room every second.
   */
  tickInterval: NodeJS.Timeout | null = null;

  private _name: string = "(uninitialized)";
  public get name(): string {
    try {
      return super.name;
    } catch {
      return this._name;
    }
  }

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

    const state: PersistedServerState = {
      version: PERSISTED_STATE_VERSION,
      name: this.name,
      ...this.validRoom.toStorage(),
    };
    // console.debug(state);
    await this.ctx.storage.put("state", state);
  }

  /**
   * Restores the state of the room, e.g. when the Durable Object gets restarted.
   */
  async restoreState(ctx: DurableObjectState = this.ctx) {
    const state = await ctx.storage.get<PersistedServerState>("state");
    if (!state) {
      // the room is not valid, nothing to do
      return;
    }

    this._name = state.name;
    if (state.version !== PERSISTED_STATE_VERSION) {
      this.logger.warn(`Discarding state with old version ${state.version}`);
      return;
    }

    this.logger.info("Restoring state...");
    this.validRoom = ValidRoom.fromStorage(this, state);
  }

  /**
   * Creates a ValidRoom instance, allowing players to connect to this room.
   */
  public async createValidRoom() {
    try {
      this._name = super.name;
    } catch { }

    this.validRoom = new ValidRoom(this);
    this.logger.info("Room created.");

    await this.scheduleCleanup();
  }

  /**
   * Returns whether this room is valid or not.
   */
  public isValidRoom(): boolean {
    return this.validRoom !== undefined;
  }

  /**
   * Calculates the current number of active WebSocket connections with the "player" tag in the room.
   *
   * @returns The count of connected clients.
   */
  public getActivePlayersCount(): number {
    let count = 0;
    for (const _connection of this.getActiveConnections("player")) {
      count++;
    }
    return count;
  }

  /**
   * Hook to invalidate the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   */
  private async onDelayedCleanup() {
    if (this.getActivePlayersCount() === 0) {
      this.validRoom = undefined;
      await this.saveState();

      this.logger.info("Room closed due to timeout.");
    } else {
      await this.scheduleCleanup();
    }
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

  /**
   * Called every second as soon as the first player connects.
   */
  public async onTick() {
    try {
      if (this.validRoom) {
        this.validRoom.onTick();

        // re-schedule cleanup, as the room is still active while the tick loop is running
        await this.scheduleCleanup();
      } else {
        this.stopTickInterval();
      }

      await this.saveState();
    } catch (e) {
      this.logger.error("Error running SongGuessServer#onTick():");
      this.logger.error(e);
    }
  }

  /**
   * Stops the tick loop, if running.
   */
  public stopTickInterval() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
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

    // kick player if room is not created yet
    if (!this.validRoom) {
      conn.close(4000, "Room ID not found");
      this.logger.info(`${conn.state} tried connecting to non-validated room.`);
      return;
    }

    // start the tick interval
    if (!this.tickInterval) {
      this.tickInterval = setInterval(this.onTick.bind(this), 1000);
    }

    this.logger.info(`${conn.state} connected.`);

    try {
      await this.validRoom.onConnect(conn, ctx);
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
    } catch (e) {
      this.logger.error("Error running ValidRoom#onMessage():");
      this.logger.error(e);
    }
  }

  /**
   * Handles a WebSocket connection that was closed.
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
      // the websocket is already closed before this got called, so this will run after the last player left
      if (this.getActivePlayersCount() === 0) {
        this.logger.info(`Last client left, room will close in ${ROOM_CLEANUP_TIMEOUT} seconds if no one joins.`);

        // stopping the tick interval will also stop re-scheduling the cleanup - so the cleanup will eventually run
        this.stopTickInterval();

        await this.saveState();
      }

      await this.validRoom.onClose(conn);
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
        onlineCount: this.getActivePlayersCount(),
        isValidRoom: this.isValidRoom(),
      };

      return Response.json(json);
    }

    return new Response("Bad request. Only GET is supported.", { status: 400 });
  }

  //
  // ROOM ALARM EVENT SCHEDULING
  // code inspired by https://developers.cloudflare.com/durable-objects/api/alarms/#scheduling-multiple-events-with-a-single-alarm
  //

  /**
   * (Re-)Schedules a cleanup after ROOM_CLEANUP_TIMEOUT seconds.
   */
  async scheduleCleanup(): Promise<void> {
    return this.scheduleEvent("cleanup", ROOM_CLEANUP_TIMEOUT * 1000);
  }

  /**
   * (Re-)Schedules a host transfer to another player after ROOM_HOST_TRANSFER_TIMEOUT seconds.
   */
  public async scheduleHostTransfer() {
    return this.scheduleEvent("host_transfer", ROOM_HOST_TRANSFER_TIMEOUT * 1000);
  }

  /**
   * (Re-)Schedules a one-time or recurring event.
   * @param id - The unique identifier for the event.
   * @param runAfter - The time (in milliseconds) after which the event should execute.
   * @param repeatMs - The repetition interval in milliseconds, or null if one-time.
   */
  async scheduleEvent(id: ScheduledAlarmEvent["id"], runAfter: number, repeatMs: number | null = null): Promise<void> {
    const runAt = Date.now() + runAfter;
    await this.ctx.storage.put<ScheduledAlarmEvent>(`event:${id}`, { id, runAt, repeatMs });
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm || runAt < currentAlarm) {
      await this.ctx.storage.setAlarm(runAt);
    }
  }

  /**
   * Cancels a scheduled event by its identifier and removes it from storage.
   * @param id - The unique identifier of the event to cancel.
   * @returns true if the event existed and was removed, false if not
   */
  async cancelEvent(id: ScheduledAlarmEvent["id"]): Promise<boolean> {
    return this.ctx.storage.delete(`event:${id}`);
  }

  /**
   * The alarm handler invoked by the Cloudflare Workers runtime.
   */
  async alarm(): Promise<void> {
    const now = Date.now();
    const events = await this.ctx.storage.list<ScheduledAlarmEvent>({ prefix: "event:" });
    let nextAlarm: number | null = null;

    for (const [key, event] of events) {
      if (event.runAt <= now) {
        try {
          await this.processEvent(event);
        } catch (e) {
          this.logger.error(`Error processing alarm ${event.id}:`);
          this.logger.error(e);
        }
        if (event.repeatMs) {
          event.runAt = now + event.repeatMs;
          await this.ctx.storage.put(key, event);
        } else {
          await this.ctx.storage.delete(key);
        }
      }
      // Track the next event time
      if (event.runAt > now && (!nextAlarm || event.runAt < nextAlarm)) {
        nextAlarm = event.runAt;
      }
    }

    if (nextAlarm) {
      await this.ctx.storage.setAlarm(nextAlarm);
    }
  }

  /**
   * Processes an individual scheduled event.
   * @param event - The event object to be processed.
   */
  async processEvent(event: ScheduledAlarmEvent): Promise<void> {
    switch (event.id) {
      case "cleanup":
        await this.onDelayedCleanup();
        break;
      case "host_transfer":
        if (this.validRoom) {
          await this.validRoom.onDelayedHostTransfer();
        } else {
          this.logger.info("Skipped delayed host transfer because validRoom is not set.");
        }
        break;
    }
  }
}
