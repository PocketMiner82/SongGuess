import type * as Party from "partykit/server";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";
import z from "zod";
import {setInterval, setTimeout, clearInterval, clearTimeout} from "node:timers";
import {ClientMessageSchema, OtherMessageSchema} from "../schemas/MessageSchemas";
import Question, {DistractionError} from "./Question";
import {
  COLORS,
  POINTS_PER_QUESTION,
  QUESTION_COUNT,
  ROOM_CLEANUP_TIMEOUT, ROUND_PAUSE_MUSIC,
  ROUND_SHOW_ANSWER,
  ROUND_START,
  ROUND_START_MUSIC,
  ROUND_START_NEXT, TIME_PER_QUESTION
} from "./ServerConstants";
import { version } from "../../package.json";
import type {RoomGetResponse} from "../types/APIResponseTypes";
import type {
  AddPlaylistMessage, AudioControlMessage, ChangeUsernameMessage,
  ClientMessage, ConfirmationMessage,
  CountdownMessage,
  GameState,
  PlayerState,
  Playlist,
  PongMessage, RemovePlaylistMessage, RoomConfigMessage, SelectAnswerMessage,
  Song, SourceMessage, UpdateMessage, UpdatePlayedSongsMessage, UpdatePlaylistsMessage
} from "../types/MessageTypes";


// noinspection JSUnusedGlobalSymbols
export default class Server implements Party.Server {
  /**
   * Log messages are prefixed with this string.
   */
  readonly LOG_PREFIX: string = `[Room ${this.room.id}]`;


  /**
   * True, if this room was created by a request to /createRoom
   */
  isValidRoom: boolean = false;

  /**
   * Timeout to clean up the room if no players join after {@link ROOM_CLEANUP_TIMEOUT} seconds.
   */
  cleanupTimeout: NodeJS.Timeout|null = null;

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
   * Whether to perform advanced song filtering.
   * @see {@link RoomConfigMessage.advancedSongFiltering}
   */
  advancedSongFiltering: boolean = true;

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

  /**
   * The timestamp when the current round started.
   */
  roundStartTime: number = -1;

  /**
   * The interval function for the main game loop.
   */
  gameLoopInterval: NodeJS.Timeout|null = null;

  /**
   * The current tick count within the ongoing round.
   */
  roundTicks: number = 0;

  /**
   * The list of questions for the current game.
   */
  questions: Question[] = [];

  /**
   * The index of the current question.
   */
  currentQuestion: number = 0;

  /**
   * A list of songs still available for use in the next round.
   * This pool is used to avoid repeating songs within a single game session.
   */
  remainingSongs: Song[] = [];


  /**
   * Creates a new room server.
   *
   * @param room The room to serve
   */
  constructor(readonly room: Party.Room) { }

  //
  // ROOM WS EVENTS
  //

  /**
   * Handles a new WebSocket connection to the room.
   *
   * @param conn The new connection.
   * @param _ctx The connection context (unused).
   */
  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    this.log(`${conn.id} connected.`);

    // kick player if room is not created yet
    if (!this.isValidRoom) {
      conn.close(4000, "Room ID not found");
      return;
    }

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

    // inform client about played songs in this round
    if (this.state === "results") {
      conn.send(this.getPlayedSongsUpdateMessage());
    }

    // inform player about current question
    if (this.state === "ingame") {
      let q = this.questions[this.currentQuestion];

      if (this.roundTicks < ROUND_SHOW_ANSWER) {
        conn.send(q.getQuestionMessage(this.currentQuestion + 1));
      } else {
        conn.send(q.getAnswerMessage(this.currentQuestion + 1));
      }

      setTimeout(() => {
        conn.send(this.getAudioControlMessage("load", q.song.audioURL));

        if (this.roundTicks >= ROUND_START_MUSIC) {
          conn.send(this.getAudioControlMessage("play"));
        }
      }, 50);
    }
  }

  /**
   * Handles incoming messages from a WebSocket connection.
   *
   * @param message The message content as a string.
   * @param conn The connection that sent the message.
   */
  onMessage(message: string, conn: Party.Connection) {
    // ignore all messages if room is not valid
    if (!this.isValidRoom) {
      return;
    }

    // when room is valid: always refresh inactive timeout
    this.refreshKickPlayerTimeout(conn);

    // try to parse JSON
    try {
      // noinspection ES6ConvertVarToLetConst
      var json = JSON.parse(message);
    } catch {
      this.log(`${conn.id} sent: ${message}`, "debug");
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.log(`${conn.id} sent: ${message}`, "debug");
      this.log(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`, "warn");
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    let msg = result.data;

    // don't log ping/pong
    if (msg.type !== "ping" && msg.type !== "pong")
      this.log(`${conn.id} sent: ${message}`, "debug");

    // handle each message type
    switch(msg.type) {
      case "ping":
        // always directly answer pings
        conn.send(JSON.stringify({
          type: "pong",
          seq: msg.seq
        } satisfies PongMessage));
        break;
      case "pong":
        // currently ignored
        break;
      case "confirmation":
        if (msg.error) {
          this.log(`Client reported an error for ${msg.sourceMessage.type}:\n${msg.error}`, "warn");
        }
        break;
      case "change_username":
        this.changeUsername(conn, msg);
        break;
      case "add_playlist":
      case "remove_playlist":
        if (!this.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
          return;
        }

        if (msg.type === "add_playlist" && !this.addPlaylist(msg)) {
          conn.send(this.getPlaylistsUpdateMessage());
          this.sendConfirmationOrError(conn, msg, "Please provide a playlist with a unique name and album cover.");
          return;
        } else if (msg.type === "remove_playlist" && !this.removePlaylist(msg)) {
          conn.send(this.getPlaylistsUpdateMessage());
          this.sendConfirmationOrError(conn, msg, `Index out of bounds: ${msg.index}`);
          return;
        }

        // always re-filter songs after playlist update
        this.filterSongs();

        // send the update to all players + confirmation to the host
        this.room.broadcast(this.getPlaylistsUpdateMessage());
        this.sendConfirmationOrError(conn, msg);
        break;
      case "room_config":
        if (!this.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
          return;
        }

        // update filtered songs if config for that changed
        if (msg.advancedSongFiltering !== undefined) {
          this.advancedSongFiltering = msg.advancedSongFiltering;
          this.filterSongs();

          this.room.broadcast(this.getConfigMessage());
          this.room.broadcast(this.getPlaylistsUpdateMessage());
        }
        break;
      case "start_game":
        if (!this.performChecks(conn, msg, "host", "not_ingame", "not_contdown")) {
          return;
        }

        if (!this.performChecks(conn, msg, "min_song_count")) {
          return;
        }

        // make sure setting distractions worked
        try {
          this.regenerateRandomQuestions();
        } catch (e) {
          if (this.hostConnection && e instanceof DistractionError) {
            this.sendConfirmationOrError(this.hostConnection, msg, e.message);
          } else if (this.hostConnection) {
            this.sendConfirmationOrError(this.hostConnection, msg, "Unknown error while starting game.");
            this.log(e, "error");
          }
          return;
        }

        this.sendConfirmationOrError(conn, msg);
        this.startGame();
        break;
      case "select_answer":
        if (!this.performChecks(conn, msg, "answer")) {
          return;
        }

        this.selectAnswer(conn, msg);
        break;
      case "return_to":
        if (!this.performChecks(conn, msg, "host", "not_lobby")) {
          return;
        }

        switch (msg.where) {
          case "lobby":
            this.resetGame();
            // returning to lobby will force to include all songs again
            this.remainingSongs = [];
            break;
          case "results":
            this.endGame();
            break;
        }

        this.broadcastUpdateMessage();
        break;
      default:
        // in case a message is defined but not yet implemented
        this.sendConfirmationOrError(conn, msg, `Not implemented: ${(msg as ClientMessage).type}`);
        break;
    }
  }

  /**
   * Handles a WebSocket connection closing.
   *
   * @param conn The connection that closed.
   */
  onClose(conn: Party.Connection) {
    // ignore disconnects if room is not valid
    if (!this.isValidRoom) {
      return;
    }

    this.log(`${conn.id} left.`);

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

    // no more players left
    if (this.getOnlineCount() === 0) {
      this.delayedCleanup();

      this.log(`Last client left, room will close in ${ROOM_CLEANUP_TIMEOUT} seconds if no one joins...`);
    } else {
      // inform all clients about changes, including possible host transfer
      this.broadcastUpdateMessage();
    }
  }

  //
  // NORMAL FUNCTIONS
  //

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
   *               - "min_song_count": Checks whether the minimum song count is reached.
   * @returns true, if ALL checks were successful, false otherwise.
   */
  private performChecks(conn: Party.Connection|null, msg: SourceMessage,
        ...checks: ("host" | "lobby" | "not_lobby" | "not_contdown" | "not_ingame" | "min_song_count" | "answer")[]): boolean {
    let possibleErrorFunc = conn
        ? (error: string)=> {
          conn.send(this.getUpdateMessage(conn));
          this.sendConfirmationOrError(conn, msg, error);
        }
        : () => {};
    let successful: boolean = true;
    let connState: PlayerState = conn?.state as PlayerState;

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
          if (this.songs.length < QUESTION_COUNT) {
            possibleErrorFunc(`Required at least ${QUESTION_COUNT} songs. Selected: ${this.songs.length}`);
            successful = false;
          }
          break;

        case "answer":
          if (this.roundTicks > ROUND_SHOW_ANSWER || this.roundTicks < ROUND_START_MUSIC) {
            possibleErrorFunc("Can only accept answering during questioning phase.");
            successful = false;
          } else if (conn && connState.answerIndex !== undefined) {
            possibleErrorFunc("You already selected an answer.");
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
   * @returns true if the playlist was added successfully, false if validation failed.
   */
  private addPlaylist(msg: AddPlaylistMessage): boolean {
    if (!msg.playlist.songs || this.playlists.some(p =>
        p.name === msg.playlist.name && p.cover === msg.playlist.cover
    )) {
      return false;
    }

    this.playlists.push(msg.playlist);
    this.log(`The playlist "${msg.playlist.name}" has been added.`);
    return true;
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

            if (this.advancedSongFiltering) {
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
  private removePlaylist(msg: RemovePlaylistMessage): boolean {
    if (msg.index !== null && msg.index >= this.playlists.length) {
      return false;
    }

    if (msg.index !== null) {
      let playlistName = this.playlists[msg.index].name;
      this.playlists.splice(msg.index, 1);
      this.log(`The playlist "${playlistName}" has been removed.`);
    } else {
      this.playlists = [];
      this.log(`All playlists have been removed.`);
    }
    return true;
  }

  /**
   * Changes the username for a connected player.
   *
   * @param conn The connection of the player requesting the change.
   * @param msg The message with the username change request.
   */
  private changeUsername(conn: Party.Connection, msg: ChangeUsernameMessage) {
    // username is already validated, just check if it's used by another player
    for (let connection of this.room.getConnections()) {
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
  private stopCountdown() {
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
  private startCountdown(from: number, callback: () => void) {
    const decrementCountdown = () => {
      this.room.broadcast(this.getCountdownMessage());

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
   * Starts a countdown, then starts the game loop. Also resets the game before starting.
   * You must set/regenerate questions before calling this.
   * @see {@link resetGame}
   * @see {@link regenerateRandomQuestions}
   * @see {@link endGame}
   */
  private startGame() {
    /**
     * The main game loop. Assumes that game is reset before called.
     * @see {@link resetGame}
     */
    const gameLoop = () => {
      if (this.roundTicks >= ROUND_START_NEXT) {
        this.roundTicks = 0;
        this.currentQuestion++;
        for (let conn of this.room.getConnections()) {
          this.resetPlayerAnswerData(conn);
        }
      }

      if (this.currentQuestion >= this.questions.length) {
        this.endGame();
        return;
      }

      let q = this.questions[this.currentQuestion];
      switch (this.roundTicks++) {
        // send question directly at start
        case ROUND_START:
          this.room.broadcast(q.getQuestionMessage(this.currentQuestion + 1));
          this.broadcastUpdateMessage();

          // load audio of song to guess
          this.room.broadcast(this.getAudioControlMessage("load", q.song.audioURL));
          break;

        // start playback of song to guess
        case ROUND_START_MUSIC:
          this.roundStartTime = Date.now();
          this.room.broadcast(this.getAudioControlMessage("play"));
          break;

        // show results of current round
        case ROUND_SHOW_ANSWER:
          this.calculatePoints();

          // shows which player voted for which question
          this.broadcastUpdateMessage();

          this.room.broadcast(q.getAnswerMessage(this.currentQuestion + 1));
          break;

        // pause music to allow fade out
        case ROUND_PAUSE_MUSIC:
          this.room.broadcast(this.getAudioControlMessage("pause"));
          break;
      }
    }

    // inform all players about the game start
    this.broadcastUpdateMessage();

    this.startCountdown(3, () => {
      this.resetGame();
      this.state = "ingame";
      this.broadcastUpdateMessage();

      setTimeout(gameLoop, 50);
      this.gameLoopInterval = setInterval(gameLoop, 1000);
    });
  }

  /**
   * Resets the game to the lobby state.
   *
   * @see {@link endGame}
   */
  private resetGame() {
    this.endGame(false);
    this.stopCountdown();

    this.roundTicks = 0;
    this.currentQuestion = 0;
    this.state = "lobby";

    // reset points of all players
    for (let conn of this.room.getConnections()) {
      this.resetPlayerAnswerData(conn, true);
    }
  }

  /**
   * Clears and then adds random song guessing questions to the room.
   * Creates {@link QUESTION_COUNT} random questions for the current game session.
   */
  private regenerateRandomQuestions() {
    this.questions = [];

    // add QUESTION_COUNT random questions
    for (let i = 0; i < QUESTION_COUNT; i++) {
      if (this.remainingSongs.length === 0) {
        const usedAudioUrls = new Set(this.questions.map(q => q.song.audioURL));
        this.remainingSongs = this.songs.filter(song => !usedAudioUrls.has(song.audioURL));
      }

      let randomIndex = Math.floor(Math.random() * this.remainingSongs.length);
      this.questions.push(new Question(this.remainingSongs.splice(randomIndex, 1)[0]))
    }

    // add distractions to the questions
    for (const q of this.questions) {
      q.generateDistractions(this.songs);
    }
  }

  /**
   * Save timestamp and index, when user selects an answer.
   *
   * @param conn the player that selected an answer.
   * @param msg the {@link SelectAnswerMessage} containing the selected index.
   */
  private selectAnswer(conn: Party.Connection, msg: SelectAnswerMessage) {
    let playerState: PlayerState = conn.state as PlayerState;

    playerState.questionNumber = this.currentQuestion;
    playerState.answerTimestamp = Date.now();
    playerState.answerSpeed = playerState.answerTimestamp - this.roundStartTime;
    playerState.answerIndex = msg.answerIndex;

    let everyoneVoted = true;
    for (let conn of this.room.getConnections()) {
      let connState = conn.state as PlayerState;
      if (connState.answerIndex === undefined) {
        everyoneVoted = false;
        break;
      }
    }

    // show answers if everyone voted
    if (everyoneVoted) {
      this.roundTicks = ROUND_SHOW_ANSWER;
    }
  }

  /**
   * Calculates the points for this round for all players that selected the correct answer.
   */
  private calculatePoints() {
    for (let conn of this.room.getConnections()) {
      let connState = conn.state as PlayerState;

      if (connState.answerTimestamp && connState.answerIndex === this.questions[this.currentQuestion].getAnswerIndex()) {
        // half the points for correct answer
        connState.points += POINTS_PER_QUESTION / 2;

        // remaining points depend on speed of answer
        let factor = Math.max(0, (TIME_PER_QUESTION * 1000 - (connState.answerTimestamp - this.roundStartTime)))
            / (TIME_PER_QUESTION * 1000);
        connState.points += (POINTS_PER_QUESTION / 2) * factor;

        connState.points = Math.round(connState.points);
      }
    }
  }

  /**
   * Ends the current game without resetting and transitions to the results state.
   *
   * @param sendUpdate whether to send an update that the game ended to the players.
   */
  private endGame(sendUpdate: boolean = true) {
    if (!this.gameLoopInterval) return;

    clearInterval(this.gameLoopInterval);
    this.gameLoopInterval = null;

    this.room.broadcast(this.getAudioControlMessage("pause"));

    this.state = "results";

    // the update message always contains the points, displaying ranks is handled client-side
    if (sendUpdate) {
      this.broadcastUpdateMessage();
      this.room.broadcast(this.getPlayedSongsUpdateMessage());
    }
  }

  /**
   * Transfers host to another client after 3 seconds if the client does not join again.
   */
  private delayedHostTransfer() {
    this.hostConnection = null;

    this.hostTransferTimeout = setTimeout(() => {
      if (this.hostConnection === null) {
        let next = this.room.getConnections()[Symbol.iterator]().next();
        if (!next.done) {
          this.log(`Host left, transferring host to ${next.value.id}`);
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
  private transferHost(newHost: Party.Connection|undefined, sendUpdate: boolean = true) {
    this.hostConnection = newHost;
    this.hostID = newHost?.id;

    if (newHost) {
      newHost.send(this.getConfigMessage());
      if (sendUpdate) {
        this.broadcastUpdateMessage();
      }
    }
  }

  /**
   * Invalidates the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   * Uses milliseconds for the setTimeout function (ROOM_CLEANUP_TIMEOUT * 1000).
   */
  private delayedCleanup() {
    this.cleanupTimeout = setTimeout(() => {
      if (this.getOnlineCount() === 0) {
        this.resetRoom();
        this.log("Room closed due to timeout.");
      }
      this.cleanupTimeout = null;
    }, ROOM_CLEANUP_TIMEOUT * 1000);
  }

  /**
   * Resets the room to its initial state.
   * @private
   */
  private resetRoom() {
    this.resetGame();

    this.isValidRoom = false;
    this.cleanupTimeout = null;
    this.hostConnection = undefined;
    this.hostID = undefined;
    this.hostTransferTimeout = null;
    this.cachedStates = new Map();
    this.playlists = [];
    this.advancedSongFiltering = true;
    this.songs = [];
    this.countdownInterval = null;
    this.countdown = 0;
    this.state = "lobby";
    this.roundStartTime = -1;
    this.gameLoopInterval = null;
    this.roundTicks = 0;
    this.questions = [];
    this.currentQuestion = 0;
    this.remainingSongs = [];
  }

  /**
   * Logs a message with the {@link LOG_PREFIX}
   *
   * @param text the text to log
   * @param level the log level to use
   */
  private log(text: any, level: "debug"|"warn"|"error"|"info" = "info") {
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
   * Retrieves all valid player states from connected clients.
   * Filters out incomplete or invalid player states that don't have required properties.
   *
   * @returns An array of valid PlayerState objects from all connected players.
   */
  private getPlayerStates(): PlayerState[] {
    let states: PlayerState[] = [];
    for (let conn of this.room.getConnections()) {
      states.push(conn.state as PlayerState);
    }

    return states.filter(d => d && d.username && d.color && d.points !== undefined);
  }

  /**
   * Removes current answer data from a connection.
   * @param connection the connection for which to clear the data.
   * @param resetPoints whether to also reset the points of a player.
   * @private
   */
  private resetPlayerAnswerData(connection: Party.Connection, resetPoints:boolean = false): void {
    const currentState = connection.state as PlayerState;
    const points = resetPoints ? 0 : currentState.points;
    const playerState: PlayerState = {
      username: currentState.username,
      color: currentState.color,
      points: points
    };
    connection.setState(playerState);
  }

  /**
   * Get all colors, which aren't used by any player.
   *
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  private getUnusedColors(): string[] {
    let usedColors = this.getPlayerStates().map(item => item.color);

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
    if (connState.questionNumber !== this.currentQuestion) {
      this.resetPlayerAnswerData(conn);
    }

    // send the current playlist to the connection
    conn.send(this.getPlaylistsUpdateMessage());

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
  private refreshKickPlayerTimeout(conn: Party.Connection) {
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
  private sendConfirmationOrError(conn: Party.Connection, source: SourceMessage, error?: string) {
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
  private getUpdateMessage(conn: Party.Connection): string {
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
  private broadcastUpdateMessage() {
    for (const conn of this.room.getConnections()) {
      conn.send(this.getUpdateMessage(conn));
    }
  }

  /**
   * Constructs a played songs update message with the songs played in the last round.
   *
   * @returns a JSON string of the constructed {@link UpdatePlayedSongsMessage}
   */
  private getPlayedSongsUpdateMessage() {
    return JSON.stringify({
      type: "update_played_songs",
      songs: this.questions.map(q => q.song)
    } satisfies UpdatePlayedSongsMessage);
  }

  /**
   * Constructs a playlist update message with the current playlist array.
   *
   * @returns a JSON string of the constructed {@link UpdatePlaylistsMessage}
   */
  private getPlaylistsUpdateMessage(): string {
    return JSON.stringify({
      type: "update_playlists",
      playlists: this.playlists,
      filteredSongsCount: this.songs.length
    } satisfies UpdatePlaylistsMessage);
  }

  /**
   * Constructs a configuration update message.
   *
   * @returns a JSON string of the constructed {@link RoomConfigMessage}
   */
  private getConfigMessage(): string {
    return JSON.stringify({
      type: "room_config",
      advancedSongFiltering: this.advancedSongFiltering
    } satisfies RoomConfigMessage);
  }

  /**
   * Constructs a JSON string representing a countdown message.
   * The countdown message is sent to connected clients when the countdown is updated.
   *
   * @returns a JSON string representing the countdown message.
   * @see {@link CountdownMessage}
   */
  private getCountdownMessage(): string {
    let msg: CountdownMessage = {
      type: "countdown",
      countdown: this.countdown
    };

    return JSON.stringify(msg);
  }

  /**
   * Constructs an audio control load message.
   *
   * @param action must be "load" for a load message.
   * @param audioURL an {@link Song["audioURL"]} to a music file that the client should preload.
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
        length: Math.max(0, ROUND_START_MUSIC - this.roundTicks),
        audioURL: audioURL!
      };
    } else {
      msg = {
        type: "audio_control",
        action: action,
        length: Math.max(0, ROUND_SHOW_ANSWER - this.roundTicks)
      };
    }

    return JSON.stringify(msg);
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

    return new Response("Bad request. Only GET and POST is supported.", { status: 400 });
  }

  //
  // STATIC GLOBAL FETCH EVENTS
  //

  /**
   * Handles global fetch events for the PartyKit worker.
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
