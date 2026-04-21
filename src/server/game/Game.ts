import type {
  AudioControlMessage,
  ClientMessage,
  ProgressbarUpdateMessage,
  SelectAnswerMessage,
  ServerMessage,
  Song,
  UpdatePlayedSongsMessage,
} from "../../types/MessageTypes";
import type { IEventListener } from "../listener/IEventListener";
import type Player from "../Player";
import type { ValidRoom } from "../ValidRoom";
import type Question from "./Question";
import {
  PLAYER_PICK_TIMEOUT,
  ROUND_ANSWERING_TICK,
  ROUND_PADDING_TICKS,
  ROUND_PICKED_SONG_TICK,
  ROUND_POINTS_PER_QUESTION,
  ROUND_START_TICK,
} from "../../ConfigConstants";
import GamePhase from "./GamePhase";
import { InitError } from "./Question";


export default abstract class Game implements IEventListener {
  /**
   * Whether the game currently is running
   */
  isRunning = false;

  /**
   * The current round tick (in seconds).
   */
  roundTick: number = -1;

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
  currentQuestionIndex: number = 0;

  /**
   * The current question.
   */
  get currentQuestion(): Question | undefined {
    return this.questions[this.currentQuestionIndex];
  }

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

  protected getTimePoints(player: Player): number {
    const factor = Math.max(0, (this.room.config.timePerQuestion * 1000 - (player.answerData!.answerTimestamp - this.roundStartTime)))
      / (this.room.config.timePerQuestion * 1000);
    return (ROUND_POINTS_PER_QUESTION / 2) * factor;
  }

  /**
   * Should return an array of all required {@link ServerMessage}s so clients know about the current game state.
   * @param sendPrevious whether to include all messages for the round. Useful when client joins.
   */
  public getGameMessages(sendPrevious?: boolean): ServerMessage[] {
    const msgs: ServerMessage[] = [];
    const q = this.currentQuestion!;

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

    msgs.push(this.getProgressBarUpdateMessage());

    return msgs;
  }

  /**
   * Generates a progress bar update message based on the current game phase.
   * @returns ProgressbarUpdateMessage with duration, startAt, and elapsed time for the progress bar.
   */
  getProgressBarUpdateMessage(): ProgressbarUpdateMessage {
    let duration: number;
    let offset: number;

    switch (this.gamePhase) {
      case GamePhase.PICKING:
        duration = PLAYER_PICK_TIMEOUT;
        offset = this.roundTick - ROUND_START_TICK;
        break;
      case GamePhase.QUESTION:
        duration = -ROUND_PADDING_TICKS;
        offset = this.roundTick - ROUND_PICKED_SONG_TICK;
        break;
      case GamePhase.ANSWERING:
        duration = this.room.config.timePerQuestion;
        offset = this.roundTick - ROUND_ANSWERING_TICK;
        break;
      case GamePhase.ANSWER:
      case GamePhase.PAUSE_MUSIC:
        duration = 0;
        offset = this.roundTick - this.room.config.getRoundShowAnswerTick();
        break;
    }

    // be a bit conservative due to network latency
    duration = Math.sign(duration) * Math.max(0, Math.abs(duration) - 0.5);

    return {
      duration,
      offset,
      type: "progressbar_update",
    };
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    switch (msg.type) {
      case "select_answer":
        if (this.roundTick > this.room.config.getRoundShowAnswerTick() || this.roundTick < ROUND_ANSWERING_TICK) {
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
        if (!this.room.performChecks(player, msg, "host", "not_ingame", "not_contdown", "min_song_count")) {
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
    if (!this.isRunning)
      return;

    if (this.roundTick >= this.room.config.getRoundStartNextTick()) {
      this.roundTick = -1;
      this.currentQuestionIndex++;
      for (const player of this.room.activePlayers) {
        player.resetAnswerData();
      }
    }

    if (this.currentQuestionIndex >= this.room.config.questionsCount) {
      this.endGame();
      return;
    }

    let gamePhaseChange = false;
    let runAgain = false;
    switch (++this.roundTick) {
      // allow picking question
      case ROUND_START_TICK:
        gamePhaseChange = true;
        this.gamePhase = GamePhase.PICKING;
        // skip to ROUND_PICKED_SONG_TICK if question add was instant
        runAgain = this.tryGetNextQuestion();
        if (runAgain) {
          this.roundTick = ROUND_PICKED_SONG_TICK - 1;
        }
        break;

      // show question of current round
      case ROUND_PICKED_SONG_TICK:
        if (!this.currentQuestion?.song) {
          this.roundTick = this.room.config.getRoundStartNextTick();
          break;
        }

        gamePhaseChange = true;
        this.gamePhase = GamePhase.QUESTION;
        this.room.broadcastUpdateMessage();
        break;

      // start music playback
      case ROUND_ANSWERING_TICK:
        gamePhaseChange = true;
        this.gamePhase = GamePhase.ANSWERING;
        this.roundStartTime = Date.now();
        break;

      // show results of current round
      case this.room.config.getRoundShowAnswerTick():
        gamePhaseChange = true;
        this.gamePhase = GamePhase.ANSWER;
        this.calculatePoints();

        this.room.broadcastUpdateMessage();
        break;

      // pause music to allow fade out
      case this.room.config.getRoundPauseMusicTick():
        gamePhaseChange = true;
        this.gamePhase = GamePhase.PAUSE_MUSIC;
        break;
    }

    if (gamePhaseChange) {
      this.onGamePhaseChanged();
      this.getGameMessages(this.gamePhase === GamePhase.QUESTION && this.room.config.gameMode === "player_picks")
        .forEach(msg => this.room.server.safeBroadcast(msg));
    }

    // this allows directly jumping to the next tick interval, allowing to skip ticks
    if (runAgain) {
      this.onTick();
    }
  }

  /**
   * Called every time the game phase changed but before the game messages are sent.
   */
  public onGamePhaseChanged() { }

  /**
   * Provides the next question that should be added to the list.
   */
  protected abstract getNextQuestion(): Question;

  /**
   * Tries to get the next question.
   * @private
   * @see getNextQuestion
   * @returns true if the question add was instant
   */
  private tryGetNextQuestion() {
    try {
      const nextQuestion = this.getNextQuestion();
      this.questions.push(nextQuestion);

      if (nextQuestion.song) {
        return true;
      }
    } catch (e) {
      if (e instanceof InitError) {
        this.room.onlinePlayers.forEach((player: Player) => player.sendConfirmationOrError({ type: "other" }, e.message));
        this.room.server.logger.warn(e);
      } else {
        this.room.onlinePlayers.forEach((player: Player) => player.sendConfirmationOrError({ type: "other" }, "Unknown error while getting next question."));
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
    const currentTime = Date.now();
    player.answerData = {
      answerSpeed: currentTime - this.roundStartTime,
      answerTimestamp: currentTime,
      questionIndex: this.currentQuestionIndex,
    };

    if (this.room.config.endWhenAnswered) {
      let everyoneVoted = true;
      for (const player of this.room.activePlayers) {
        if (player.answerData === undefined) {
          everyoneVoted = false;
          break;
        }
      }

      // show answers if everyone voted
      if (everyoneVoted) {
        this.roundTick = this.room.config.getRoundShowAnswerTick() - 1;
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
        audioURL: audioURL!,
      };
    } else {
      msg = {
        type: "audio_control",
        action,
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
    if (!this.isRunning)
      return;
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
      songs: this.questions.filter(q => q.song).map(q => q.song!),
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

    this.roundTick = -1;
    this.currentQuestionIndex = 0;
    this.room.state = "lobby";

    // reset points of all players
    for (const player of this.room.activePlayers) {
      player.resetAnswerData(true);
    }
  }
}
