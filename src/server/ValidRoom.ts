import type * as Party from "partykit/server";
import type {
  CountdownMessage,
  GameState,
  PlayerMessage,
  SourceMessage,
} from "../types/MessageTypes";
import type Game from "./game/Game";
import type Server from "./Server";
import z from "zod";
import { COLORS, ROOM_HOST_TRANSFER_TIMEOUT } from "../ConfigConstants";
import { ClientMessageSchema, OtherMessageSchema } from "../schemas/MessageSchemas";
import ServerConfig from "./config/ServerConfig";
import { MultipleChoiceGame } from "./game/multipleChoice/MultipleChoiceGame";
import Listener from "./listener/Listener";
import Lobby from "./Lobby";
import Player from "./Player";

/**
 * A validated SongGuess room.
 */
export class ValidRoom implements Party.Server {
  /**
   * The listener, handling incoming messages.
   */
  readonly listener: Listener;

  /**
   * The configuration of this room.
   */
  readonly config: ServerConfig;

  /**
   * The lobby handler.
   */
  readonly lobby: Lobby;

  /**
   * The current game handler.
   */
  game: Game;

  /**
   * The player object that has host permissions in this room.
   *
   * Can be:
   *  - undefined: No host is set. If hostID is set, host left. If he doesn't reconnect within 3 seconds, another player will get host.
   *  - the actual {@link Player} object if the host is online.
   */
  host?: Player;

  /**
   * The id of the current host.
   */
  hostID: string | undefined = undefined;

  /**
   * Timeout for host transfer when the current host disconnects.
   * If the host doesn't reconnect within this timeout, another player becomes host.
   */
  hostTransferTimeout: NodeJS.Timeout | null = null;

  /**
   * Map containing all players, online and offline. Key is connection id.
   */
  players: Map<string, Player> = new Map();

  /**
   * The current countdown interval function
   */
  countdownInterval: NodeJS.Timeout | null = null;

  /**
   * The current countdown value. 0 to hide
   */
  countdown: CountdownMessage["countdown"] = 0;

  /**
   * The current state of the game.
   */
  state: GameState = "lobby";

  /**
   * List containing ALL online players.
   */
  get onlinePlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => player.isOnline);
  }

  /**
   * List containing online, non-spectating players.
   */
  get activePlayers(): Player[] {
    return Array.from(this.players.values()).filter(player => player.isOnline && !player.isSpectator);
  }

  constructor(readonly server: Server) {
    this.listener = new Listener(this);
    this.config = new ServerConfig(this);
    this.game = new MultipleChoiceGame(this);
    this.lobby = new Lobby(this);
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const player = this.getOrCreatePlayer(conn);

    if (!player.onConnect(ctx))
      return;

    if (!this.host && !this.hostID && !player.isSpectator) {
      this.transferHost(player, false);
    } else if (!this.host && this.hostID === conn.id && !player.isSpectator) {
      this.server.logger.info("Host reconnected.");
      // host joined again within timeout
      this.transferHost(player, false);

      if (this.hostTransferTimeout) {
        clearTimeout(this.hostTransferTimeout);
        this.hostTransferTimeout = null;
      }
    }

    // send the first update to the connection (and inform all other connections about the new player)
    this.broadcastUpdateMessage();
  }

  onMessage(message: string, conn: Party.Connection) {
    const player = this.getOrCreatePlayer(conn);

    // refresh inactive timeout (admins don't have that)
    if (!this.server.hasTag(conn, "admin")) {
      player.refreshKickTimeout();
    }

    // try to parse JSON
    let json: ReturnType<typeof JSON.parse>;
    try {
      json = JSON.parse(message);
    } catch {
      this.server.logger.debug(`From ${conn.id}: ${message}`);
      player.sendConfirmationOrError(OtherMessageSchema.parse({}), "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.server.logger.debug(`From ${conn.id}: ${message}`);
      this.server.logger.warn(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`);
      player.sendConfirmationOrError(OtherMessageSchema.parse({}), `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    const msg = result.data;

    // don't log ping/pong
    if (msg.type !== "ping" && msg.type !== "pong")
      this.server.logger.debug(`From ${conn.id}: ${message}`);

    // handle host transfer request
    if (msg.type === "transfer_host") {
      if (!this.performChecks(player, msg, "host")) {
        return;
      }

      const newHost = this.getActivePlayerByName(msg.playerName);
      if (!newHost) {
        player.sendConfirmationOrError(msg, `Player '${msg.playerName}' not found.`);
        return;
      }

      player.sendConfirmationOrError(msg);
      this.transferHost(newHost);
      return;
    }

    this.listener.handleMessage(player, msg);
  }

  /**
   * Called every second by the server
   */
  onTick() {
    this.listener.handleTick();

    if (this.activePlayers.length > 0) {
      for (const player of this.activePlayers) {
        if (!this.host || player.conn.id === this.hostID)
          return;
      }

      // host left
      this.delayedHostTransfer();
    }
  }

  onClose(conn: Party.Connection) {
    this.getOrCreatePlayer(conn).onClose();

    // host left
    if (this.hostID === conn.id) {
      this.delayedHostTransfer();
    }

    // inform all clients about changes, including possible host transfer
    this.broadcastUpdateMessage();
  }

  /**
   * Returns the instance of the current {@link Party.Room}
   */
  public getPartyRoom(): Party.Room {
    return this.server.partyRoom;
  }

  /**
   * Gets a player from the players map. If not found, create new player.
   * @param conn the connection to search for
   */
  public getOrCreatePlayer(conn: Party.Connection): Player {
    let player = this.players.get(conn.id);
    if (!player) {
      player = new Player(this, conn);
      this.players.set(conn.id, player);
    } else {
      player.conn = conn;
    }
    return player;
  }

  /**
   * Performs one or more of the specified checks.
   *
   * @param player The player to perform the checks for.
   * @param msg The message that caused the check.
   * @param checks One of the following:
   *  - "host": Checks whether the connection is the host or an admin.
   *  - "lobby": Checks whether the game is currently in lobby.
   *  - "not_lobby": Checks for the opposite.
   *  - "not_contdown": Checks whether a countdown is currently running.
   *  - "not_ingame": Checks whether currently not ingame.
   *  - "min_song_count": Checks whether the minimum song count is reached.
   * @returns true, if ALL checks were successful, false otherwise.
   */
  public performChecks(player: Player | null, msg: SourceMessage, ...checks: ("host" | "lobby" | "not_lobby" | "not_contdown" | "not_ingame" | "min_song_count")[]): boolean {
    const possibleErrorFunc = player
      ? (error: string) => {
          player.sendUpdateMessage();
          player.sendConfirmationOrError(msg, error);
        }
      : () => {};
    let successful: boolean = true;

    for (const element of checks) {
      switch (element) {
        case "host":
          if (!player || (this.host !== player && !this.server.hasTag(player.conn, "admin"))) {
            possibleErrorFunc("Action can only be used by host.");
            successful = false;
          }
          break;

        case "lobby":
          if (this.state !== "lobby") {
            possibleErrorFunc("Action can only be used in lobby.");
            successful = false;
          }
          break;

        case "not_lobby":
          if (this.state === "lobby") {
            possibleErrorFunc("Action can only be used when not in lobby.");
            successful = false;
          }
          break;

        case "not_contdown":
          if (this.countdownInterval !== null) {
            possibleErrorFunc("Action cannot be performed while countdown is running.");
            successful = false;
          }
          break;

        case "not_ingame":
          if (this.state === "ingame") {
            possibleErrorFunc("Action can only be used when not ingame.");
            successful = false;
          }
          break;

        case "min_song_count":
          if (this.lobby.songs.length < this.config.questionsCount && this.config.gameMode === "multiple_choice") {
            possibleErrorFunc(`Required at least ${this.config.questionsCount} songs. Selected: ${this.lobby.songs.length}`);
            successful = false;
          }
          break;
      }
    }

    // always send update when not successful
    if (!successful && player) {
      player.sendUpdateMessage();
    }

    return successful;
  }

  /**
   * Transfers host to another client after ROOM_HOST_TRANSFER_TIMEOUT seconds if the client does not join again.
   */
  public delayedHostTransfer() {
    this.host = undefined;

    this.hostTransferTimeout = setTimeout(() => {
      if (this.host === undefined) {
        const next = this.activePlayers[Symbol.iterator]().next();
        if (!next.done) {
          this.server.logger.info(`Host left, transferring host to ${next.value.conn.id}`);
          this.transferHost(next.value);
        } else {
          this.transferHost(undefined);
        }
      }

      this.hostTransferTimeout = null;
    }, ROOM_HOST_TRANSFER_TIMEOUT * 1000);
  }

  /**
   * Transfers the host to another connection
   * @param newHost the new host connection. Undefined if no one should be the host.
   * @param sendUpdate whether to broadcast an update (that also informs the new host that it got host).
   */
  public transferHost(newHost: Player | undefined, sendUpdate: boolean = true) {
    this.host = newHost;
    this.hostID = newHost?.conn.id;

    this.server.logger.info(`Host transferred to ${this.hostID}`);

    if (newHost && sendUpdate) {
      this.broadcastUpdateMessage();
    }
  }

  /**
   * Attempts to find a player by name.
   * @param name The username to search for.
   * @returns the {@link Player} associated with the name or null if not found.
   */
  public getActivePlayerByName(name: string): Player | null {
    return this.activePlayers.find(player => player.username === name) ?? null;
  }

  /**
   * Retrieves all valid player states from connected and active clients.
   *
   * @returns An array of valid PlayerMessage objects from all connected players.
   */
  public getActivePlayerMessages(): Record<string, PlayerMessage> {
    return Object.fromEntries(
      this.activePlayers.map(player => [
        player.conn.id,
        player.toPlayerMessage(),
      ]),
    );
  }

  /**
   * Get all colors, which aren't used by any player.
   *
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  public getUnusedColors(): string[] {
    const usedColors = this.activePlayers.map(player => player.color);
    return COLORS.filter(item => !usedColors.includes(item));
  }

  /**
   * Broadcast an update to all connected clients.
   *
   * @see {@link sendUpdateMessage}
   */
  public broadcastUpdateMessage() {
    for (const player of this.onlinePlayers) {
      player.sendUpdateMessage();
    }
  }

  /**
   * Starts a countdown that is shown for all players.
   * @param from The number to count down from.
   * @param callback A function to call as soon as the countdown finishes.
   */
  public startCountdown(from: number, callback: () => void) {
    const decrementCountdown = () => {
      this.server.safeBroadcast(this.getCountdownMessage());

      if (this.countdown === 0) {
        this.stopCountdown();
        callback();
        return;
      }

      this.countdown--;
    };

    this.countdown = from;
    decrementCountdown();
    this.countdownInterval = setInterval(decrementCountdown, 1000);
  }

  /**
   * Stops a countdown if running.
   */
  public stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval!);
      this.countdownInterval = null;
      this.countdown = 0;
    }
  }

  /**
   * Constructs a JSON string representing a countdown message.
   * The countdown message is sent to connected clients when the countdown is updated.
   *
   * @returns The countdown message
   */
  public getCountdownMessage(): CountdownMessage {
    return {
      type: "countdown",
      countdown: this.countdown,
    };
  }
}
