import type {ValidRoom} from "../ValidRoom";
import type {
  AudioControlMessage,
  ClientMessage,
  SelectAnswerMessage,
  ServerMessage,
  Song,
  UpdatePlayedSongsMessage
} from "../../types/MessageTypes";
import {ROUND_PADDING_TICKS, ROUND_PICKED_SONG_TICK, ROUND_START_TICK} from "../../ConfigConstants";
import GamePhase from "./GamePhase";
import Question, {InitError} from "./Question";
import type {IEventListener} from "../listener/IEventListener";
import type Player from "../Player";


export default abstract class Game implements IEventListener {
  /**
   * Whether the game currently is running
   */
  isRunning = false;

  /**
   * The current tick count within the ongoing round.
   */
  roundTicks: number = -1;

  /**
   * The timestamp when the current round started.
   */
  roundStartTime: number = -1;

  /**
   * The current game phase
   */
  gamePhase: GamePhase = GamePhase.PICKING;

  /**
   * The index of the current question. Zero-based.
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
   * Destorys this Game object.
   */
  public destroy(): void {
    this.room.listener.unregisterEvents(this);
  }


  /**
   * Should calculate the points for this round for all players that selected the correct answer.
   */
  abstract calculatePoints(): void;

  /**
   * Should return an array of all required {@link ServerMessage}s so clients know about the current game state.
   * @param sendPrevious whether to include all messages for the round. Useful when client joins.
   */
  public getGameMessages(sendPrevious?: boolean): ServerMessage[] {
    let msgs: ServerMessage[] = [];
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
        case GamePhase.PICKING:
          msgs.push(q.getQuestionMessage());
          break;

        case GamePhase.QUESTION:
          // load audio of song to guess
          msgs.push(this.getAudioControlMessage("load", q.song!.audioURL));
          break;

        case GamePhase.ANSWERING:
          msgs.push(this.getAudioControlMessage("play"));
          break;

        case GamePhase.ANSWER:
          msgs.push(q.getAnswerMessage());
          break;
      }
    }

    return msgs;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    switch (msg.type) {
      case "select_answer":
        if (this.roundTicks > this.room.config.getRoundShowAnswerTick() || this.roundTicks < ROUND_PADDING_TICKS + ROUND_PICKED_SONG_TICK) {
          player.sendUpdateMessage();
          player.sendConfirmationOrError(msg, "Can only accept answers during questioning phase.");
          return true;
        } else if (player.answerData !== undefined) {
          player.sendUpdateMessage();
          player.sendConfirmationOrError(msg, "You already selected an answer.");
          return true;
        } else if (this.room.config.gameMode === "multiple_choice" && msg.answerIndex === undefined) {
          player.sendUpdateMessage();
          player.sendConfirmationOrError(msg, "You need to provide an answerIndex key.");
          return true;
        } else if (this.room.config.gameMode === "player_picks" && msg.answer === undefined) {
          player.sendUpdateMessage();
          player.sendConfirmationOrError(msg, "You need to provide an answer key.");
          return true;
        }

        this.selectAnswer(player, msg);
        player.sendConfirmationOrError(msg);
        return true;
      case "start_game":
        if(!this.room.performChecks(player, msg, "host", "not_ingame", "not_contdown", "min_song_count")) {
          return true;
        }

        player.sendConfirmationOrError(msg);
        this.startGame();
        return true;

      case "return_to":
        if (!this.room.performChecks(player, msg, "host", "not_lobby")) {
          return true;
        }

        switch (msg.where) {
          case "lobby":
            this.resetToLobby();
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

    if (this.roundTicks >= this.room.config.getRoundStartNextTick()) {
      this.roundTicks = -1;
      this.currentQuestion++;
      for (let player of this.room.activePlayers) {
        player.resetAnswerData();
      }
    }

    if (this.currentQuestion >= this.room.config.questionsCount) {
      this.endGame();
      return;
    }

    let sendGameMessage = false;
    let runAgain = false;
    switch (++this.roundTicks) {
      // allow picking question
      case ROUND_START_TICK:
        sendGameMessage = true;
        this.gamePhase = GamePhase.PICKING;
        // skip to ROUND_PICKED_SONG_TICK if question add was instant
        runAgain = this.tryGetNextQuestion();
        if (runAgain) {
          this.roundTicks = ROUND_PICKED_SONG_TICK - 1;
        }
        break;

      // show question of current round
      case ROUND_PICKED_SONG_TICK:
        if (!this.questions[this.currentQuestion].song) {
          this.roundTicks = this.room.config.getRoundStartNextTick();
          break;
        }

        sendGameMessage = true;
        this.gamePhase = GamePhase.QUESTION;
        this.room.broadcastUpdateMessage();
        break;

      // start music playback
      case ROUND_PADDING_TICKS + ROUND_PICKED_SONG_TICK:
        sendGameMessage = true;
        this.gamePhase = GamePhase.ANSWERING;
        this.roundStartTime = Date.now();
        break;

      // show results of current round
      case this.room.config.getRoundShowAnswerTick():
        sendGameMessage = true;
        this.gamePhase = GamePhase.ANSWER;
        this.calculatePoints();

        this.room.broadcastUpdateMessage();
        break;

      // pause music to allow fade out
      case this.room.config.getRoundPauseMusicTick():
        sendGameMessage = true;
        this.gamePhase = GamePhase.PAUSE_MUSIC;
        break;
    }

    if (sendGameMessage) {
      this.getGameMessages().forEach(msg => this.room.server.safeBroadcast(msg));
    }

    // this allows directly jumping to the next tick interval, allowing to skip ticks
    if (runAgain) {
      this.onTick();
    }
  }

  /**
   * Provides the next question that should be added to the list.
   */
  protected abstract getNextQuestion(): Question

  /**
   * Tries to get the next question.
   * @private
   * @see getNextQuestion
   * @returns true if the question add was instant
   */
  private tryGetNextQuestion() {
    try {
      let nextQuestion = this.getNextQuestion();
      this.questions.push(nextQuestion);

      if (nextQuestion.song) {
        return true;
      }
    } catch (e) {
      if (e instanceof InitError) {
        this.room.players.forEach((player: Player) => player.sendConfirmationOrError({type: "other"}, e.message));
        this.room.server.logger.warn(e);
      } else {
        this.room.players.forEach((player: Player) => player.sendConfirmationOrError({type: "other"},
            "Unknown error while getting next question."));
        this.room.server.logger.error(e);
      }

      this.endGame();
    }
    return false;
  }

  /**
   * Save timestamp and answer, when user selects an answer.
   *
   * @param player the player that selected an answer.
   * @param _msg the {@link SelectAnswerMessage} containing the selected answer.
   */
  public selectAnswer(player: Player, _msg: SelectAnswerMessage) {
    let currentTime = Date.now();
    player.answerData = {
      answerSpeed: currentTime - this.roundStartTime,
      answerTimestamp: currentTime,
      questionNumber: this.currentQuestion
    };

    if (this.room.config.endWhenAnswered) {
      let everyoneVoted = true;
      for (let player of this.room.activePlayers) {
        if (player.answerData === undefined) {
          everyoneVoted = false;
          break;
        }
      }

      // show answers if everyone voted
      if (everyoneVoted) {
        this.roundTicks = this.room.config.getRoundShowAnswerTick() - 1;
      }
    }
  }

  /**
   * Constructs an audio control load message.
   *
   * @param action must be "load" for a load message.
   * @param audioURL an {@link Song["audioURL"]} to a music file that the client should preload.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  public getAudioControlMessage(action: "load", audioURL?: Song["audioURL"]): AudioControlMessage;
  /**
   * Constructs an audio control message.
   *
   * @param action the {@link AudioControlMessage["action"]} that should be performed.
   * @param audioURL can only be provided for load action.
   * @returns a JSON string of the constructed {@link AudioControlMessage}
   */
  public getAudioControlMessage(action: Exclude<AudioControlMessage["action"], "load">, audioURL?: never): AudioControlMessage;
  public getAudioControlMessage(action: AudioControlMessage["action"], audioURL?: Song["audioURL"]): AudioControlMessage {
    let msg: AudioControlMessage;

    if (action === "load") {
      // load requires an audio URL
      msg = {
        type: "audio_control",
        action: "load",
        position: this.roundTicks - ROUND_PICKED_SONG_TICK,
        audioURL: audioURL!
      };
    } else {
      msg = {
        type: "audio_control",
        action: action,
        position: Math.max(0, this.roundTicks - ROUND_PADDING_TICKS - ROUND_PICKED_SONG_TICK)
      };
    }

    return msg;
  }

  /**
   * Starts a countdown, then starts the game loop. Also resets the game before starting.
   * You must set/regenerate questions before calling this.
   * @see {@link resetToLobby}
   * @see {@link getNextQuestion}
   * @see {@link endGame}
   */
  public startGame() {
    this.room.server.logger.info("Starting game...");

    // always clear questions at start
    this.questions = [];

    // inform all players about the game start
    this.room.broadcastUpdateMessage();

    this.room.startCountdown(3, () => {
      this.resetToLobby();
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
  public endGame(sendUpdate: boolean = true) {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.room.server.logger.info("Ending game...");

    this.room.server.safeBroadcast(this.getAudioControlMessage("pause"));

    this.room.state = "results";

    // the update message always contains the points, displaying ranks is handled client-side
    if (sendUpdate) {
      this.room.broadcastUpdateMessage();
      this.room.server.safeBroadcast(this.getPlayedSongsUpdateMessage());
    }
  }

  /**
   * Constructs a played songs update message with the songs played in the last round.
   *
   * @returns a JSON string of the constructed {@link UpdatePlayedSongsMessage}
   */
  public getPlayedSongsUpdateMessage(): UpdatePlayedSongsMessage {
    return {
      type: "update_played_songs",
      songs: this.questions.map(q => q.song)
    };
  }

  /**
   * Resets the game to the lobby state.
   *
   * @see {@link endGame}
   */
  public resetToLobby() {
    this.endGame(false);
    this.room.stopCountdown();

    this.room.server.logger.info("Resetting game to lobby state...");

    this.roundTicks = -1;
    this.currentQuestion = 0;
    this.room.state = "lobby";

    // reset points of all players
    for (let player of this.room.activePlayers) {
      player.resetAnswerData(true);
    }
  }
}