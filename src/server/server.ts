import type * as Party from "partykit/server";
import { adjectives, nouns, uniqueUsernameGenerator } from "unique-username-generator";
import z from "zod";
import { fetchGetRoom, fetchPostRoom } from "../RoomHTTPHelper";
import type { RoomInfoResponse, PostCreateRoomResponse } from "../schemas/RoomHTTPSchemas";
import {
  type GameState,
  type PlayerData,
  type UpdateMessage,
  type UpdatePlaylistsMessage,
  type AudioControlMessage,
  type CountdownMessage,
  type PlayerState
} from "../schemas/RoomServerMessageSchemas";
import { setInterval, setTimeout, clearInterval } from "node:timers";
import {
  ClientMessageSchema,
  type ClientMessage,
  type ConfirmationMessage,
  type SourceMessage, OtherMessageSchema
} from "../schemas/RoomMessageSchemas";
import {
  type Playlist,
  type Song,
  COLORS,
  artistRegex,
  albumRegex,
  UnknownPlaylist,
  songRegex
} from "../schemas/RoomSharedMessageSchemas";
import Question from "./Question";
import type {
  AddPlaylistMessage,
  ChangeUsernameMessage,
  RemovePlaylistMessage, SelectAnswerMessage
} from "../schemas/RoomClientMessageSchemas";


/**
 * The time (in seconds) after which an empty room is cleaned up.
 */
const ROOM_CLEANUP_TIMEOUT = 10;

/**
 * The number of questions to generate per game.
 */
const QUESTION_COUNT = 3;

/**
 * The time allocated for each question in seconds.
 */
const TIME_PER_QUESTION = 20;

/**
 * The tick count when a round starts.
 */
const ROUND_START = 0;

/**
 * The tick count when music starts playing in a round.
 */
const ROUND_START_MUSIC = 5;

/**
 * The tick count when the answer is revealed in a round.
 */
const ROUND_SHOW_ANSWER = ROUND_START_MUSIC + TIME_PER_QUESTION;

/**
 * The tick count when the next round starts.
 */
const ROUND_START_NEXT = ROUND_SHOW_ANSWER + 5;

/**
 * How many points a player can get per question.
 * Half of the points are for a correct answer, the other half is for the speed of the answer if correct.
 */
const POINTS_PER_QUESTION = 1000;


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
   * The index of the current question (1-based).
   */
  currentQuestion: number = 1;


  /**
   * Creates a new room server.
   *
   * @param room The room to serve
   */
  constructor(readonly room: Party.Room) {}

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

    this.log(`${conn.id} sent: ${message}`, "debug");

    // try to parse JSON
    try {
      // noinspection ES6ConvertVarToLetConst
      var json = JSON.parse(message);
    } catch {
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), "Message is not JSON.");
      return;
    }

    // check if received message is valid
    const result = ClientMessageSchema.safeParse(json);
    if (!result.success) {
      this.log(`Parsing client message from ${conn.id} failed:\n${z.prettifyError(result.error)}`, "warn");
      this.sendConfirmationOrError(conn, OtherMessageSchema.parse({}), `Parsing error:\n${z.prettifyError(result.error)}`);
      return;
    }

    let msg = result.data;

    // handle each message type
    switch(msg.type) {
      case "confirmation":
        if (msg.error) {
          this.log(`Client reported an error for ${msg.sourceMessage.type}:\n${msg.error}`, "warn");
        }
        break;
      case "change_username":
        if (!this.performChecks(conn, msg, "lobby")) {
          return;
        }

        this.changeUsername(conn, msg);
        break;
      case "add_playlist":
      case "remove_playlist":
        if (!this.performChecks(conn, msg, "host", "lobby", "countdown")) {
          return;
        }

        if (msg.type === "add_playlist" && !this.addPlaylist(msg)) {
          conn.send(this.getPlaylistUpdateMessage());
          this.sendConfirmationOrError(conn, msg, "Please provide a playlist with a unique name and album cover.");
          return;
        } else if (msg.type === "remove_playlist" && !this.removePlaylist(msg)) {
          conn.send(this.getPlaylistUpdateMessage());
          this.sendConfirmationOrError(conn, msg, `Index out of bounds: ${msg.index}`);
          return;
        }

        this.updateSongs();

        // send the update to all players + confirmation to the host
        this.room.broadcast(this.getPlaylistUpdateMessage());
        this.sendConfirmationOrError(conn, msg);
        break;
      case "start_game":
        if (!this.performChecks(conn, msg, "host", "lobby", "countdown", "min_song_count")) {
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
      case "return_to_lobby":
        if (!this.performChecks(conn, msg, "host", "not_lobby")) {
          return;
        }

        this.resetGame();
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
   * @param connection The connection that closed.
   */
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
        this.log(`Host left, transferring host to ${next.value.id}`);
        this.hostConnection = next.value;
      }
    }

    // no more players left
    if (this.getOnlineCount() === 0) {
      this.hostConnection = null;
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
   *               - "countdown": Checks whether a countdown is currently running.
   *               - "min_song_count": Checks whether the minimum song count is reached.
   * @returns true, if ALL checks were successful, false otherwise.
   */
  private performChecks(conn: Party.Connection|null, msg: SourceMessage, ...checks: ("host" | "lobby" | "not_lobby" | "countdown" | "min_song_count" | "answer")[]): boolean {
    let possibleErrorFunc = conn ? (error: string) => this.sendConfirmationOrError(conn, msg, error) : () => {};
    let successful: boolean = true;
    let connData: PlayerData = conn?.state as PlayerData;

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
            possibleErrorFunc("Action can only be used not in lobby.");
            successful = false;
          }
          break;

        case "countdown":
          if (this.countdownInterval !== null) {
            possibleErrorFunc("Action cannot be performed while countdown is running.");
            successful = false;
          }
          break;

        case "min_song_count":
          // todo: calculate this if implementing variable question count
          if (this.songs.length < 30) {
            possibleErrorFunc(`Required at least 30 songs. Selected: ${this.songs.length}`);
            successful = false;
          }
          break;

        case "answer":
          if (this.roundTicks >= ROUND_SHOW_ANSWER || this.roundTicks < ROUND_START_MUSIC) {
            possibleErrorFunc("Can only accept answering during questioning phase.");
            successful = false;
          } else if (conn && connData.answerIndex) {
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
   * Removes a playlist from the current game session by index.
   *
   * @param msg The message containing the index of the playlist to remove.
   * @returns true if the playlist was removed successfully, false if the index was out of bounds.
   */
  private removePlaylist(msg: RemovePlaylistMessage): boolean {
    if (msg.index >= this.playlists.length) {
      return false;
    }

    let playlistName = this.playlists[msg.index].name;
    this.playlists.splice(msg.index, 1);
    this.log(`The playlist "${playlistName}" has been removed.`);
    return true;
  }

  /**
   * Updates the songs array by collecting all songs from the current playlists.
   * Also updates the subtitle of each playlist to show the song count.
   */
  private updateSongs() {
    this.songs = [];
    for (let playlist of this.playlists) {
      let songCount = playlist.songs ? playlist.songs.length : 0;
      playlist.subtitle = `${songCount} song${songCount === 1 ? "" : "s"}`;
      if (!playlist.songs) {
        continue;
      }
      this.songs.push(...playlist.songs);
    }
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
      let state = connection.state as PlayerData;
      if (connection !== conn && state.username === msg.username) {
        conn.send(this.getUpdateMessage(conn));
        this.sendConfirmationOrError(conn, msg, "Username is already taken.");
        return;
      }
    }
    (conn.state as PlayerData).username = msg.username;

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
   * Starts a countdown, then starts the game loop.
   * Will reset the game state before starting
   * @see resetGame
   * @see endGame
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
      }

      if (this.currentQuestion > this.questions.length) {
        this.endGame();
      }

      let q = this.questions[this.currentQuestion - 1];
      switch (this.roundTicks++) {
        // send question directly at start
        case ROUND_START:
          this.room.broadcast(q.getQuestionMessage(this.currentQuestion));

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

          // this also shows which player voted for which question
          this.room.broadcast(q.getAnswerMessage(this.currentQuestion, this.getAllPlayerData()));
          for (let conn of this.room.getConnections()) {
            this.resetPlayerAnswerData(conn);
          }
          break;
      }
    }

    // inform all players about the game start
    this.broadcastUpdateMessage();

    this.startCountdown(3, () => {
      this.resetGame();
      this.state = "ingame";
      this.broadcastUpdateMessage();

      this.addRandomQuestions();
      gameLoop();
      this.gameLoopInterval = setInterval(gameLoop, 1000);
    });
  }

  /**
   * Resets the game to the lobby state.
   *
   * @see endGame
   */
  private resetGame() {
    this.endGame(false);
    this.stopCountdown();

    this.roundTicks = 0;
    this.questions = [];
    this.currentQuestion = 1;
    this.state = "lobby";

    // reset points of all players
    for (let conn of this.room.getConnections()) {
      this.resetPlayerAnswerData(conn, true);
    }
  }

  /**
   * Add random song guessing questions to the room.
   */
  private addRandomQuestions() {
    let remainingSongs = this.songs;

    // add 10 random questions
    for (let i = 0; i < QUESTION_COUNT; i++) {
      let randomIndex = Math.floor(Math.random() * remainingSongs.length);
      this.questions.push(new Question(remainingSongs.splice(randomIndex, 1)[0]));
    }

    // add distractions to the questions
    for (const q of this.questions) {
      q.generateDistractions(remainingSongs);
    }
  }

  /**
   * Save timestamp and index, when user selects an answer.
   *
   * @param conn
   * @param msg
   */
  private selectAnswer(conn: Party.Connection, msg: SelectAnswerMessage) {
    let playerData: PlayerData = conn.state as PlayerData;

    playerData.answerTimestamp = Date.now();
    playerData.answerIndex = msg.answerIndex;
  }

  /**
   * Calculates the points for this round for all players that selected the correct answer.
   */
  private calculatePoints() {
    for (let conn of this.room.getConnections()) {
      let connData = conn.state as PlayerData;

      if (connData.answerTimestamp && connData.answerIndex === this.questions[this.currentQuestion].getAnswerIndex()) {
        // half the points for correct answer
        connData.points += POINTS_PER_QUESTION / 2;

        // remaining points depend on speed of answer
        let factor = Math.max(0, (TIME_PER_QUESTION * 1000 - (connData.answerTimestamp - this.roundStartTime)))
            / (TIME_PER_QUESTION * 1000);
        connData.points += (POINTS_PER_QUESTION / 2) * factor;

        connData.points = Math.round(connData.points);
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
    if (sendUpdate) this.broadcastUpdateMessage();
  }

  /**
   * Invalidates the room if no players join within {@link ROOM_CLEANUP_TIMEOUT} seconds.
   */
  private delayedCleanup() {
    this.cleanupTimeout = setTimeout(() => {
      if (this.getOnlineCount() === 0) {
        this.isValidRoom = false;
        this.resetGame();
        this.log("Room closed due to timeout.");
      }
      this.cleanupTimeout = null;
    }, ROOM_CLEANUP_TIMEOUT * 1000);
  }

  /**
   * Logs a message with the {@link LOG_PREFIX}
   *
   * @param text the text to log
   * @param level the log level to use
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

  private getAllPlayerData(): PlayerData[] {
    let data: PlayerData[] = [];
    for (let conn of this.room.getConnections()) {
      data.push(conn.state as PlayerData);
    }

    return data;
  }

  /**
   * Removes current answer data from a connection.
   * @param connection the connection for which to clear the data.
   * @param resetPoints whether to also reset the points of a player.
   * @private
   */
  private resetPlayerAnswerData(connection: Party.Connection, resetPoints:boolean = false): void {
    const currentData = connection.state as PlayerData;
    const points = resetPoints ? 0 : currentData.points;
    const playerData: PlayerData = {
      username: currentData.username,
      color: currentData.color,
      points: points
    };
    connection.setState(playerData);
  }

  /**
   * Get all usernames and there associated color
   *
   * @returns A map containing the username as keys and their color as values
   */
  private getAllPlayerStates(): PlayerState[] {
    return this.getAllPlayerData()
        .filter(d => d && d.username && d.color)
        .map(d => ({
          username: d.username,
          color: d.color
        } as PlayerState))
  }

  /**
   * Get all colors, which aren't used by any player
   *
   * @returns A string array of unused colors or an empty array if all colors are used.
   */
  private getUnusedColors(): string[] {
    let usedColors = this.getAllPlayerStates().map(item => item.color);

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

    let connData: PlayerData = {
      username: username,
      color: color,
      points: 0
    };

    conn.setState(connData);

    // send the current playlist to the connection
    conn.send(this.getPlaylistUpdateMessage());

    return true;
  }

  /**
   * Sends a confirmation or error message to the player, along with an update message.
   *
   * @param conn The connection of the player that should receive the messages
   * @param source The source/type of the confirmation message
   * @param error An optional error message to include in the confirmation
   * @see {@link getUpdateMessage}
   */
  private sendConfirmationOrError(conn: Party.Connection, source: SourceMessage, error?: string) {
    let resp: ConfirmationMessage = {
      type: "confirmation",
      sourceMessage: source,
      error: error
    }

    conn.send(this.getUpdateMessage(conn));
    conn.send(JSON.stringify(resp));
  }

  /**
   * Constructs an update message with the current room/connection states to the connection.
   *
   * @param conn the connection to send the update to
   * @returns a JSON string of the constructed {@link UpdateMessage}
   */
  private getUpdateMessage(conn: Party.Connection): string {
    let connData = conn.state as PlayerData;

    let msg: UpdateMessage = {
      type: "update",
      state: this.state,
      players: this.getAllPlayerStates(),
      username: connData.username,
      color: connData.color,
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
   * Constructs a playlist update message with the current playlist array.
   *
   * @returns a JSON string of the constructed {@link UpdatePlaylistsMessage}
   */
  private getPlaylistUpdateMessage(): string {
    let playlists = structuredClone(this.playlists);
    for (let p of playlists) {
      // do not send songs in playlist updates
      delete p.songs;
    }

    let update: UpdatePlaylistsMessage = {
      type: "update_playlists",
      playlists: playlists
    };

    return JSON.stringify(update);
  }

  /**
   * Returns a JSON string representing a countdown message.
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

  /**
   * Handles HTTP requests to the room endpoint.
   *
   * @param req The HTTP request to handle.
   * @returns A Promise resolving to the HTTP response.
   */
  async onRequest(req: Party.Request): Promise<Response> {
    let url: URL = new URL(req.url);

    // handle room creation
    if (url.pathname.endsWith("/createRoom")) {
      return await Server.createNewRoom(new URL(req.url).origin, this.room.env.VALIDATE_ROOM_TOKEN as string);
    // handle playlist info request
    } else if (url.pathname.endsWith("/playlistInfo")) {
      // fetch playlist info
      let playlistURL = url.searchParams.get("url");
      if (!playlistURL) {
        return new Response("Missing url parameter.", { status: 400 });
      }

      return Response.json(await Server.getPlaylistInfo(playlistURL));
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
   * Fetches playlist information from an Apple Music URL.
   *
   * @param url The Apple Music URL of the playlist.
   * @returns A Promise resolving to the Playlist information.
   */
  private static async getPlaylistInfo(url: string): Promise<Playlist> {
    if (!artistRegex.test(url) && !albumRegex.test(url) && !songRegex.test(url)) {
      return UnknownPlaylist;
    }

    let page = await fetch(url);
    let text = await page.text();

    // get content of schema.org tag <script id=schema:music-[...] type="application/ld+json">
    let regex = /<script\s+id="?schema:(Music[^"]*|song)"?\s+type="?application\/ld\+json"?\s*>(?<json>[\s\S]*?)<\/script>/i;
    let match = regex.exec(text);
    if (!match || !match.groups) {
      return UnknownPlaylist;
    }
    let json = match.groups["json"];

    try {
      let data = JSON.parse(json);
      let name: string = data["name"];
      let cover: string|null = null;
      if (data["image"] && typeof data["image"] === "string") {
        cover = data["image"];
      }
      return {
        name: name,
        cover: cover,
        songs: []
      };
    } catch {
      return UnknownPlaylist;
    }
  }

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

// noinspection BadExpressionStatementJS
Server satisfies Party.Worker;
