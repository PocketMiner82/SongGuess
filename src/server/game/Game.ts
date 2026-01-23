import type {ValidRoom} from "../ValidRoom";
import type * as Party from "partykit/server";
import type {Connection} from "partykit/server";
import type {
  AudioControlMessage,
  ClientMessage,
  PlayerState,
  SelectAnswerMessage,
  Song, UpdatePlayedSongsMessage
} from "../../types/MessageTypes";
import {
  ROUND_PAUSE_MUSIC,
  ROUND_SHOW_ANSWER,
  ROUND_START,
  ROUND_START_MUSIC,
  ROUND_START_NEXT
} from "../config/ServerConfigConstants";
import GamePhase from "./GamePhase";
import Question, {InitError} from "./Question";
import type {IEventListener} from "../listener/IEventListener";


export default abstract class Game implements IEventListener {
  /**
   * Whether the game currently is running
   */
  isRunning = false;

  /**
   * The current tick count within the ongoing round.
   */
  roundTicks: number = 0;

  /**
   * The timestamp when the current round started.
   */
  roundStartTime: number = -1;

  /**
   * The current game phase
   */
  gamePhase: GamePhase = GamePhase.QUESTION;

  /**
   * A list of songs still available for use in the next round.
   * This pool is used to avoid repeating songs within a single game session.
   */
  remainingSongs: Song[] = [];

  /**
   * The index of the current question.
   */
  currentQuestion: number = 0;

  /**
   * The list of questions for the current game.
   */
  abstract questions: Question[];


  constructor(readonly room: ValidRoom) {
    room.listener.registerEvents(this);
  }


  /**
   * Should calculate the points for this round for all players that selected the correct answer.
   */
  abstract calculatePoints(): void;

  /**
   * Should create and return a new {@link Question} object.
   */
  abstract createQuestion(song: Song): Question;

  /**
   * Should return an array of all required {@link ServerMessage}s so clients know about the current game state.
   * @param sendPrevious whether to include all messages for the round. Useful when client joins.
   */
  getGameMessages(sendPrevious?: boolean): string[] {
    let msgs: string[] = [];
    let q = this.questions[this.currentQuestion];

    // nothing to send if game is not running
    if (!this.isRunning) {
      return msgs;
    }

    // directly return pause message if this is the end of the round and next round starts shortly...
    if (this.gamePhase === GamePhase.PAUSE_MUSIC) {
      msgs.push(this.getAudioControlMessage("pause"));
      return msgs;
    }

    // also append all previous messages if requested
    for (let i = sendPrevious ? 0 : this.gamePhase; i <= this.gamePhase; i++) {
      switch (i) {
        case GamePhase.QUESTION:
          msgs.push(q.getQuestionMessage(this.currentQuestion + 1));
          // load audio of song to guess
          msgs.push(this.getAudioControlMessage("load", q.song.audioURL));
          break;

        case GamePhase.ANSWERING:
          msgs.push(this.getAudioControlMessage("play"));
          break;

        case GamePhase.ANSWER:
          msgs.push(q.getAnswerMessage(this.currentQuestion + 1));
          break;
      }
    }

    return msgs;
  }

  onMessage(conn: Connection, msg: ClientMessage): boolean {
    let connState: PlayerState = conn.state as PlayerState;

    switch (msg.type) {
      case "select_answer":
        if (this.roundTicks > ROUND_SHOW_ANSWER || this.roundTicks < ROUND_START_MUSIC) {
          conn.send(this.room.getUpdateMessage(conn));
          this.room.sendConfirmationOrError(conn, msg, "Can only accept answers during questioning phase.");
          return true;
        } else if (conn && connState.answerIndex !== undefined) {
          conn.send(this.room.getUpdateMessage(conn));
          this.room.sendConfirmationOrError(conn, msg, "You already selected an answer.");
          return true;
        }

        this.selectAnswer(conn, msg);
        return true;
      case "start_game":
        if(!this.room.performChecks(conn, msg, "host", "not_ingame", "not_contdown", "min_song_count")) {
          return true;
        }

        // make sure initialization worked
        try {
          this.regenerateRandomQuestions();
        } catch (e) {
          if (this.room.hostConnection && e instanceof InitError) {
            this.room.sendConfirmationOrError(this.room.hostConnection, msg, e.message);
          } else if (this.room.hostConnection) {
            this.room.sendConfirmationOrError(this.room.hostConnection, msg, "Unknown error while starting game.");
            this.room.server.log(e, "error");
          }
          return true;
        }

        this.room.sendConfirmationOrError(conn, msg);
        this.startGame();
        return true;

      case "return_to":
        if (!this.room.performChecks(conn, msg, "host", "not_lobby")) {
          return true;
        }

        switch (msg.where) {
          case "lobby":
            this.returnToLobby();
            break;
          case "results":
            this.endGame();
            break;
        }

        this.room.broadcastUpdateMessage();
        return true;
    }

    return false;
  }

  onTick() {
    if (!this.isRunning) return;

    if (this.roundTicks >= ROUND_START_NEXT) {
      this.roundTicks = 0;
      this.currentQuestion++;
      for (let conn of this.room.getPartyRoom().getConnections()) {
        this.resetPlayerAnswerData(conn);
      }
    }

    if (this.currentQuestion >= this.room.config.questionCount) {
      this.endGame();
      return;
    }

    let sendUpdate = false;
    switch (this.roundTicks++) {
      // show question of current round
      case ROUND_START:
        sendUpdate = true;
        this.gamePhase = GamePhase.QUESTION;
        this.room.broadcastUpdateMessage();
        break;

      // start music playback
      case ROUND_START_MUSIC:
        sendUpdate = true;
        this.gamePhase = GamePhase.ANSWERING;
        this.roundStartTime = Date.now();
        break;

      // show results of current round
      case ROUND_SHOW_ANSWER:
        sendUpdate = true;
        this.gamePhase = GamePhase.ANSWER;
        this.calculatePoints();

        this.room.broadcastUpdateMessage();
        break;

      // pause music to allow fade out
      case ROUND_PAUSE_MUSIC:
        sendUpdate = true;
        this.gamePhase = GamePhase.PAUSE_MUSIC;
        break;
    }

    if (sendUpdate) {
      this.getGameMessages().forEach(msg => this.room.getPartyRoom().broadcast(msg));
    }
  }

  /**
   * Clears and then adds random song guessing questions to the room.
   * Creates {@link ServerConfig.questionCount} random questions for the current game session.
   */
  private regenerateRandomQuestions() {
    this.questions = [];

    // add QUESTION_COUNT random questions
    for (let i = 0; i < this.room.config.questionCount; i++) {
      if (this.remainingSongs.length === 0) {
        const usedAudioUrls = new Set(this.questions.map(q => q.song.audioURL));
        this.remainingSongs = this.room.lobby.songs.filter(song => !usedAudioUrls.has(song.audioURL));
      }

      let randomIndex = Math.floor(Math.random() * this.remainingSongs.length);
      this.questions.push(this.createQuestion(this.remainingSongs.splice(randomIndex, 1)[0]))
    }

    // add distractions to the questions
    for (const q of this.questions) {
      q.init(this.room.lobby.songs);
    }
  }

  /**
   * Save timestamp and index, when user selects an answer.
   *
   * @param conn the player that selected an answer.
   * @param msg the {@link SelectAnswerMessage} containing the selected index.
   */
  selectAnswer(conn: Party.Connection, msg: SelectAnswerMessage) {
    let playerState: PlayerState = conn.state as PlayerState;

    playerState.questionNumber = this.currentQuestion;
    playerState.answerTimestamp = Date.now();
    playerState.answerSpeed = playerState.answerTimestamp - this.roundStartTime;

    this.room.sendConfirmationOrError(conn, msg);

    let everyoneVoted = true;
    for (let conn of this.room.getPartyRoom().getConnections()) {
      let connState = conn.state as PlayerState;
      if (connState.answerTimestamp === undefined) {
        everyoneVoted = false;
        break;
      }
    }

    // show answers if everyone voted
    if (everyoneVoted && this.room.config.endWhenAnswered) {
      this.roundTicks = ROUND_SHOW_ANSWER;
    }
  }

  /**
   * Removes current answer data from a connection.
   * @param connection the connection for which to clear the data.
   * @param resetPoints whether to also reset the points of a player.
   * @public
   */
  resetPlayerAnswerData(connection: Party.Connection, resetPoints:boolean = false): void {
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
   * Constructs an audio control load message.
   *
   * @param action must be "load" for a load message.
   * @param audioURL an {@link Song["audioURL"]} to a music file that the client should preload.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  getAudioControlMessage(action: "load", audioURL?: Song["audioURL"]): string;
  /**
   * Constructs an audio control message.
   *
   * @param action the {@link AudioControlMessage["action"]} that should be performed.
   * @param audioURL can only be provided for load action.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  getAudioControlMessage(action: Exclude<AudioControlMessage["action"], "load">, audioURL?: never): string;
  getAudioControlMessage(action: AudioControlMessage["action"], audioURL?: Song["audioURL"]): string {
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

  /**
   * Starts a countdown, then starts the game loop. Also resets the game before starting.
   * You must set/regenerate questions before calling this.
   * @see {@link returnToLobby}
   * @see {@link regenerateRandomQuestions}
   * @see {@link endGame}
   */
  startGame() {
    // inform all players about the game start
    this.room.broadcastUpdateMessage();

    this.room.startCountdown(3, () => {
      this.returnToLobby();
      this.room.state = "ingame";
      this.room.broadcastUpdateMessage();

      this.isRunning = true;
    });
  }

  /**
   * Ends the current game without returning to lobby and transitions to the results state.
   *
   * @param sendUpdate whether to send an update that the game ended to the players.
   */
  endGame(sendUpdate: boolean = true) {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.room.getPartyRoom().broadcast(this.getAudioControlMessage("pause"));

    this.room.state = "results";

    // the update message always contains the points, displaying ranks is handled client-side
    if (sendUpdate) {
      this.room.broadcastUpdateMessage();
      this.room.getPartyRoom().broadcast(this.getPlayedSongsUpdateMessage());
    }
  }

  /**
   * Constructs a played songs update message with the songs played in the last round.
   *
   * @returns a JSON string of the constructed {@link UpdatePlayedSongsMessage}
   */
  public getPlayedSongsUpdateMessage() {
    return JSON.stringify({
      type: "update_played_songs",
      songs: this.questions.map(q => q.song)
    } satisfies UpdatePlayedSongsMessage);
  }

  /**
   * Resets the game to the lobby state.
   *
   * @see {@link endGame}
   */
  returnToLobby() {
    this.endGame(false);
    this.room.stopCountdown();

    this.roundTicks = 0;
    this.currentQuestion = 0;
    this.room.state = "lobby";

    // reset points of all players
    for (let conn of this.room.getPartyRoom().getConnections()) {
      this.resetPlayerAnswerData(conn, true);
    }
  }
}