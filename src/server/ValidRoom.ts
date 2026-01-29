import type Server from "./Server";
import type * as Party from "partykit/server";
import type {
  ConfirmationMessage,
  CountdownMessage,
  GameState,
  PlayerState,
  SelectAnswerMessage,
  SourceMessage,
  UpdateMessage
} from "../types/MessageTypes";
import {COLORS} from "../ConfigConstants";
import {ClientMessageSchema, OtherMessageSchema} from "../schemas/MessageSchemas";
import z from "zod";
import {adjectives, nouns, uniqueUsernameGenerator} from "unique-username-generator";
import {version} from "../../package.json";
import ServerConfig from "./config/ServerConfig";
import Listener from "./listener/Listener";
import type Game from "./game/Game";
import {MultipleChoiceGame} from "./game/multipleChoice/MultipleChoiceGame";
import GamePhase from "./game/GamePhase";
import Lobby from "./Lobby";


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
   * The current game handler.
   */
  readonly game: Game;

  /**
   * The lobby handler.
   */
  readonly lobby: Lobby;

  /**
   * Map containing timeouts to kick inactive players. Key is connection id.
   */
  kickPlayerTimeouts: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

  /**
   * This is the websocket connection of the host.
   *
   * Can be:
   *  - undefined: No host is set.
   *  - null: Host left. If he doesn't reconnect within 3 seconds, another player will get host.
   *  - the actual {@link Party.Connection} object if the host is online.
   */
  hostConnection: Party.Connection|null|undefined = undefined;

  /**
   * The id of the current host.
   */
  hostID: string|undefined = undefined;

  /**
   * Timeout for host transfer when the current host disconnects.
   * If the host doesn't reconnect within this timeout, another player becomes host.
   */
  hostTransferTimeout: NodeJS.Timeout|null = null;

  /**
   * Cached player states for reconnection scenarios.
   * Maps connection IDs to player states to preserve data when players disconnect and reconnect.
   */
  cachedStates: Map<string, PlayerState> = new Map();

  /**
   * The current countdown interval function
   */
  countdownInterval: NodeJS.Timeout|null = null;

  /**
   * The current countdown value. 0 to hide
   */
  countdown: CountdownMessage["countdown"] = 0;

  /**
   * The current state of the game.
   */
  state: GameState = "lobby";


  constructor(readonly server: Server) {
    this.listener = new Listener(this);
    this.config = new ServerConfig(this);
    this.game = new MultipleChoiceGame(this);
    this.lobby = new Lobby(this);
  }

  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    let color = this.getUnusedColors()[0];

    if (!color) {
      conn.close(4002, "Room is full.");
      return;
    }

    if (this.hostConnection === undefined) {
      this.transferHost(conn, false);
    } else if (this.hostConnection === null && this.hostID === conn.id) {
      this.server.logger.info("Host reconnected.");
      // host joined again within timeout
      this.transferHost(conn, false);

      if (this.hostTransferTimeout) {
        clearTimeout(this.hostTransferTimeout);
        this.hostTransferTimeout = null;
      }
    }

    let username = uniqueUsernameGenerator({
      dictionaries: [adjectives, nouns],
      style: "titleCase",
      length: 16
    });

    // load state if there is one from previous connect
    let connState = this.cachedStates.get(conn.id) ?? {} as PlayerState;
    connState.username = username;
    connState.color = color;
    connState.points = connState.points ?? 0;

    conn.setState(connState);

    // clear cached answer when we're already at the next question
    if (connState.questionNumber !== this.game.currentQuestion) {
      this.game.resetPlayerAnswerData(conn);
    }

    // send the current playlist to the connection
    conn.send(this.lobby.getPlaylistsUpdateMessage());

    // inform client about current round state
    this.game.getGameMessages(true).forEach(msg => conn.send(msg));

    // send client's answer if client selected one previously
    if (connState.answerIndex !== undefined) {
      this.sendConfirmationOrError(conn, {
        type: "select_answer",
        answerIndex: connState.answerIndex
      } satisfies SelectAnswerMessage);
    }

    // send played songs to client
    if (this.state === "results") {
      conn.send(this.game.getPlayedSongsUpdateMessage());
    }

    // send current config
    this.getPartyRoom().broadcast(this.config.getConfigMessage());

    // kicks player if inactive
    this.refreshKickPlayerTimeout(conn);

    // send the first update to the connection (and inform all other connections about the new player)
    this.broadcastUpdateMessage();
  }

  onMessage(message: string, conn: Party.Connection) {
    // always refresh inactive timeout
    this.refreshKickPlayerTimeout(conn);

    // try to parse JSON
    try {
      // noinspection ES6ConvertVarToLetConst
      var json = JSON.parse(message);
    } catch {
      this.server.logger.debug(`${conn.id} sent: ${message}`);
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.server.logger.debug(`${conn.id} sent: ${message}`);
      this.server.logger.warn(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`);
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    let msg = result.data;

    // don't log ping/pong
    if (msg.type !== "ping" && msg.type !== "pong")
      this.server.logger.debug(`${conn.id} sent: ${message}`);

    this.listener.handleMessage(conn, msg);
  }

  /**
   * Called every second by the server
   */
  onTick() {
    this.listener.handleTick();

    if (this.server.getOnlineCount() > 0) {
      for (let conn of this.getPartyRoom().getConnections("user")) {
        if (!this.hostConnection || conn?.id === this.hostID)
          return;
      }

      // host left
      this.delayedHostTransfer();
    }
  }

  onClose(conn: Party.Connection) {
    // always remove inactive player timeouts
    let playerTimeout = this.kickPlayerTimeouts.get(conn.id);
    if (playerTimeout) {
      clearTimeout(playerTimeout);
      this.kickPlayerTimeouts.delete(conn.id);
    }

    // cache state of connection
    this.cachedStates.set(conn.id, conn.state as PlayerState);

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
   * Performs one or more of the specified checks.
   *
   * @param conn The connection to perform the checks for.
   * @param msg The message that caused the check.
   * @param checks One of the following:
   *               - "host": Checks whether the connection is the host.
   *               - "lobby": Checks whether the game is currently in lobby.
   *               - "not_lobby": Checks for the opposite.
   *               - "not_contdown": Checks whether a countdown is currently running.
   *               - "not_ingame": Checks whether currently not ingame.
   *               - "min_song_count": Checks whether the minimum song count is reached.
   * @returns true, if ALL checks were successful, false otherwise.
   */
  public performChecks(conn: Party.Connection|null, msg: SourceMessage,
                       ...checks: ("host" | "lobby" | "not_lobby" | "not_contdown" | "not_ingame" | "min_song_count")[]): boolean {
    let possibleErrorFunc = conn
        ? (error: string)=> {
          conn.send(this.getUpdateMessage(conn));
          this.sendConfirmationOrError(conn, msg, error);
        }
        : () => {};
    let successful: boolean = true;

    for (const element of checks) {
      switch (element) {
        case "host":
          if (this.hostConnection !== conn) {
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
          if (this.lobby.songs.length < this.config.questionsCount) {
            possibleErrorFunc(`Required at least ${this.config.questionsCount} songs. Selected: ${this.lobby.songs.length}`);
            successful = false;
          }
          break;
      }
    }

    // always send update when not successful
    if (!successful && conn) {
      conn.send(this.getUpdateMessage(conn));
    }

    return successful;
  }

  /**
   * Starts a countdown that is shown for all players.
   * @param from The number to count down from.
   * @param callback A function to call as soon as the countdown finishes.
   */
  public startCountdown(from: number, callback: () => void) {
    const decrementCountdown = () => {
      this.getPartyRoom().broadcast(this.getCountdownMessage());

      if (this.countdown === 0) {
        this.stopCountdown();
        callback();
        return;
      }

      this.countdown--;
    }

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
   * Transfers host to another client after 3 seconds if the client does not join again.
   */
  public delayedHostTransfer() {
    this.hostConnection = null;

    this.hostTransferTimeout = setTimeout(() => {
      if (this.hostConnection === null) {
        let next = this.getPartyRoom().getConnections("user")[Symbol.iterator]().next();
        if (!next.done) {
          this.server.logger.info(`Host left, transferring host to ${next.value.id}`);
          this.transferHost(next.value);
        } else {
          this.transferHost(undefined);
        }
      }

      this.hostTransferTimeout = null;
    }, 3000);
  }

  /**
   * Transfers the host to another connection
   * @param newHost the new host connection.
   * @param sendUpdate whether to broadcast an update (that also informs the new host that it got host).
   */
  public transferHost(newHost: Party.Connection|undefined, sendUpdate: boolean = true) {
    this.hostConnection = newHost;
    this.hostID = newHost?.id;

    this.server.logger.info(`Host transferred to ${this.hostID}`);

    if (newHost && sendUpdate) {
      this.broadcastUpdateMessage();
    }
  }

  /**
   * Retrieves all valid player states from connected clients.
   * Filters out incomplete or invalid player states that don't have required properties.
   *
   * @returns An array of valid PlayerState objects from all connected players.
   */
  public getPlayerStates(): PlayerState[] {
    let states: PlayerState[] = [];
    for (let conn of this.getPartyRoom().getConnections("user")) {
      let connState = conn.state as PlayerState;

      if (connState?.username && connState?.color && connState?.points !== undefined) {
        let newConnState: PlayerState = {
          username: connState.username,
          color: connState.color,
          points: connState.points
        };

        // only send full state when answer is available
        if (this.game.gamePhase === GamePhase.ANSWER) {
          newConnState.answerTimestamp = connState.answerTimestamp;
          newConnState.answerIndex = connState.answerIndex;
          newConnState.answerSpeed = connState.answerSpeed;
        }

        states.push(newConnState);
      }
    }

    return states;
  }

  /**
   * Get all colors, which aren't used by any player.
   *
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  public getUnusedColors(): string[] {
    let usedColors = this.getPlayerStates().map(item => item.color);

    return COLORS.filter(item => usedColors.indexOf(item) < 0);
  }

  /**
   * Resets the inactivity timer for a specific player connection.
   * If the timer expires before being refreshed again, the connection is closed.
   *
   * @param conn - The player connection to monitor for inactivity.
   */
  public refreshKickPlayerTimeout(conn: Party.Connection) {
    let playerTimeout = this.kickPlayerTimeouts.get(conn.id);
    if (playerTimeout) {
      clearTimeout(playerTimeout);
    }

    this.kickPlayerTimeouts.set(conn.id, setTimeout(() => {
      this.server.logger.info(`Kicked ${conn.id} due to inactivity.`);
      conn.close(4001, "Didn't receive updates within 15 seconds.");
    }, 15000));
  }

  /**
   * Sends a confirmation or error message to the player.
   *
   * @param conn The connection of the player that should receive the messages
   * @param source The source/type of the confirmation message
   * @param error An optional error message to include in the confirmation
   */
  public sendConfirmationOrError(conn: Party.Connection, source: SourceMessage, error?: string) {
    let resp: ConfirmationMessage = {
      type: "confirmation",
      sourceMessage: source,
      error: error
    }

    conn.send(JSON.stringify(resp));
  }

  /**
   * Constructs an update message with the current room/connection states to the connection.
   *
   * @param conn the connection to send the update to
   * @returns a JSON string of the constructed {@link UpdateMessage}
   */
  public getUpdateMessage(conn: Party.Connection): string {
    let connState = conn.state as PlayerState;

    let msg: UpdateMessage = {
      type: "update",
      version: version,
      state: this.state,
      players: this.getPlayerStates(),
      username: connState.username,
      color: connState.color,
      isHost: conn === this.hostConnection
    };

    return JSON.stringify(msg);
  }

  /**
   * Broadcast an update to all connected clients.
   *
   * @see {@link getUpdateMessage}
   */
  public broadcastUpdateMessage() {
    for (const conn of this.getPartyRoom().getConnections("user")) {
      conn.send(this.getUpdateMessage(conn));
    }
  }

  /**
   * Constructs a JSON string representing a countdown message.
   * The countdown message is sent to connected clients when the countdown is updated.
   *
   * @returns a JSON string representing the countdown message.
   * @see {@link CountdownMessage}
   */
  public getCountdownMessage(): string {
    let msg: CountdownMessage = {
      type: "countdown",
      countdown: this.countdown
    };

    return JSON.stringify(msg);
  }
}