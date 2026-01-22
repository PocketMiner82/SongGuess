import type Server from "./Server";
import type * as Party from "partykit/server";
import type {
  AddPlaylistsMessage,
  ChangeUsernameMessage,
  ConfirmationMessage,
  CountdownMessage,
  GameState,
  PlayerState,
  Playlist,
  RemovePlaylistMessage, SelectAnswerMessage,
  Song,
  SourceMessage,
  UpdateMessage,
  UpdatePlaylistsMessage
} from "../types/MessageTypes";
import {COLORS} from "./config/ServerConfigConstants";
import {ClientMessageSchema, OtherMessageSchema} from "../schemas/MessageSchemas";
import z from "zod";
import {adjectives, nouns, uniqueUsernameGenerator} from "unique-username-generator";
import {version} from "../../package.json";
import ServerConfig from "./config/ServerConfig";
import Listener from "./listener/Listener";
import type GameMode from "./game/GameMode";
import {MulitpleChoiceGameMode} from "./game/multipleChoice/MulitpleChoiceGameMode";
import GamePhase from "./game/GamePhase";


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
  readonly game: GameMode;

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
   *
   * A host can:
   *  - Select playlists
   *  - Start the game
   *  - End the game / Return all players to lobby
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
   * Currently selected playlist(s)
   */
  playlists: Playlist[] = [];

  /**
   * All songs of the currently selected playlist(s)
   */
  songs: Song[] = [];

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
    this.game = new MulitpleChoiceGameMode(this);
  }

  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    if (this.hostConnection === undefined) {
      this.transferHost(conn, false);
    } else if (this.hostConnection === null && this.hostID === conn.id) {
      // host joined again within timeout
      this.transferHost(conn, false);

      if (this.hostTransferTimeout) {
        clearTimeout(this.hostTransferTimeout);
        this.hostTransferTimeout = null;
      }
    }

    if (!this.initConnection(conn)) {
      conn.close(4002, "Room is full.");
      return;
    }

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
      this.server.log(`${conn.id} sent: ${message}`, "debug");
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.server.log(`${conn.id} sent: ${message}`, "debug");
      this.server.log(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`, "warn");
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    let msg = result.data;

    // don't log ping/pong
    if (msg.type !== "ping" && msg.type !== "pong")
      this.server.log(`${conn.id} sent: ${message}`, "debug");

    this.listener.handleMessage(conn, msg);
  }

  /**
   * Called every second by the server
   */
  onTick() {
    this.listener.handleTick();
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
    if (this.hostConnection === conn) {
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
          // todo: calculate this if implementing variable question count
          if (this.songs.length < this.config.questionCount) {
            possibleErrorFunc(`Required at least ${this.config.questionCount} songs. Selected: ${this.songs.length}`);
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
   * Adds a playlist to the current game session.
   *
   * @param msg The message containing the playlist to add.
   * @returns the amount of playlists omitted.
   */
  public addPlaylists(msg: AddPlaylistsMessage): number {
    const playlists = msg.playlists.filter(playlist =>
        playlist.songs && this.playlists.every(p =>
          p.name !== playlist.name || p.cover !== playlist.cover
    ));

    if (playlists.length > 0) {
      this.playlists.push(...playlists);
      this.server.log(`The playlist(s) ${
          playlists.map(p => p.name).join("; ")
      } has/have been added.`);
    }

    return msg.playlists.length - playlists.length;
  }

  /**
   * Updates the songs array by collecting all songs from the current playlists.
   */
  public filterSongs(): Song[] {
    this.songs = [];
    for (let playlist of this.playlists) {
      this.songs.push(...playlist.songs);
    }

    this.songs = [
      ...new Map(this.songs.map(s => {
            // filter for unique name and artist
            let normalizedName = s.name.toLowerCase();
            let normalizedArtist = s.artist.toLowerCase();

            if (this.config.advancedSongFiltering) {
              // replace parens at end like "Test Song (feat. SomeArtist) [Live]" => "Test Song"
              normalizedName = normalizedName.replace(/(\s*[[(].*[)\]]\s*)+$/, "");
            }

            return [`${normalizedName}|${normalizedArtist}`, s]
          }
      )).values()
    ];

    return this.songs;
  }

  /**
   * Removes a playlist from the current game session by index.
   *
   * @param msg The message containing the index of the playlist to remove.
   * @returns true if the playlist was removed successfully, false if the index was out of bounds.
   */
  public removePlaylist(msg: RemovePlaylistMessage): boolean {
    if (msg.index !== null && msg.index >= this.playlists.length) {
      return false;
    }

    if (msg.index !== null) {
      let playlistName = this.playlists[msg.index].name;
      this.playlists.splice(msg.index, 1);
      this.server.log(`The playlist "${playlistName}" has been removed.`);
    } else {
      this.playlists = [];
      this.server.log(`All playlists have been removed.`);
    }
    return true;
  }

  /**
   * Changes the username for a connected player.
   *
   * @param conn The connection of the player requesting the change.
   * @param msg The message with the username change request.
   */
  public changeUsername(conn: Party.Connection, msg: ChangeUsernameMessage) {
    // username is already validated, just check if it's used by another player
    for (let connection of this.getPartyRoom().getConnections()) {
      let state = connection.state as PlayerState;
      if (connection !== conn && state.username === msg.username) {
        conn.send(this.getUpdateMessage(conn));
        this.sendConfirmationOrError(conn, msg, "Username is already taken.");
        return;
      }
    }
    (conn.state as PlayerState).username = msg.username;

    // inform all players about the username change + send confirmation to the user
    this.sendConfirmationOrError(conn, msg);
    this.broadcastUpdateMessage();
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
   * Transfers host to another client after 3 seconds if the client does not join again.
   */
  public delayedHostTransfer() {
    this.hostConnection = null;

    this.hostTransferTimeout = setTimeout(() => {
      if (this.hostConnection === null) {
        let next = this.getPartyRoom().getConnections()[Symbol.iterator]().next();
        if (!next.done) {
          this.server.log(`Host left, transferring host to ${next.value.id}`);
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

    if (newHost) {
      newHost.send(this.config.getConfigMessage());
      if (sendUpdate) {
        this.broadcastUpdateMessage();
      }
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
    for (let conn of this.getPartyRoom().getConnections()) {
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
   * Set initial random username and unused color for a player.
   *
   * @param conn The connection of the player
   * @returns whether the init was successful (room was not full)
   */
  public initConnection(conn: Party.Connection): boolean {
    let username = uniqueUsernameGenerator({
      dictionaries: [adjectives, nouns],
      style: "titleCase",
      length: 16
    });

    let color = this.getUnusedColors()[0];

    if (!color) {
      return false;
    }

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
    conn.send(this.getPlaylistsUpdateMessage());

    // inform client about current round state
    this.game.getGameMessages(true).forEach(msg => conn.send(msg));

    // send players answer if player selected one previously
    if (connState.answerIndex !== undefined) {
      this.sendConfirmationOrError(conn, {
        type: "select_answer",
        answerIndex: connState.answerIndex
      } satisfies SelectAnswerMessage);
    }

    // kicks player if inactive
    this.refreshKickPlayerTimeout(conn);
    return true;
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
    for (const conn of this.getPartyRoom().getConnections()) {
      conn.send(this.getUpdateMessage(conn));
    }
  }

  /**
   * Constructs a playlist update message with the current playlist array.
   *
   * @returns a JSON string of the constructed {@link UpdatePlaylistsMessage}
   */
  public getPlaylistsUpdateMessage(): string {
    return JSON.stringify({
      type: "update_playlists",
      playlists: this.playlists,
      filteredSongsCount: this.songs.length
    } satisfies UpdatePlaylistsMessage);
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