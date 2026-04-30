import type {
  AudioControlMessage,
  ClientMessage,
  ProgressbarUpdateMessage,
  QuestionMessage,
  RoundStateMessage,
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
  POINTS_PER_QUESTION,
  QUESTION_ANSWERING_TICK,
  QUESTION_PICKED_SONG_TICK,
  QUESTION_START_TICK,
  ROUND_PADDING_TICKS,
} from "../../shared/ConfigConstants";
import GamePhase from "../../shared/game/GamePhase";
import { MultipleChoiceGame } from "./multipleChoice/MultipleChoiceGame";
import { InitError } from "./Question";


export default abstract class Game implements IEventListener {
  /**
   * Whether the game currently is running
   */
  isRunning = false;

  /**
   * The current question round tick (in seconds).
   */
  questionTick: number = 0;

  /**
   * The timestamp when the current question started.
   */
  questionStartTime: number = -1;

  /**
   * The current game phase
   */
  gamePhase: GamePhase = GamePhase.PICKING;

  /**
   * The index of the current question. 0 based.
   */
  currentQuestionIndex: number = -1;

  /**
   * Current round number. 1 based.
   */
  roundCurrent: number = 0;

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

  /**
   * Whether the game has a picking phase.
   */
  abstract hasPickingPhase: boolean;

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
   * Should calculate the points for this question for all players that selected the correct answer.
   */
  abstract calculatePoints(): void;

  protected getTimePoints(player: Player): number {
    const factor = Math.max(0, (this.room.config.timePerQuestion * 1000 - (player.answerData!.answerTimestamp - this.questionStartTime)))
      / (this.room.config.timePerQuestion * 1000);
    return (POINTS_PER_QUESTION / 2) * factor;
  }

  /**
   * Returns the round message for the current phase.
   * @param questionMsg optional question message to attach to the round message
   */
  private getRoundMessage(questionMsg?: QuestionMessage): RoundStateMessage {
    return {
      type: "round_state",
      gamePhase: this.gamePhase,
      roundCurrent: this.roundCurrent,
      question: questionMsg,
    };
  }

  /**
   * Should return an array of all required {@link ServerMessage}s so clients know about the current game state.
   * @param sendPrevious whether to include all messages for the question. Useful when client joins.
   * @param _player an optional player that requested the game messages
   */
  public getGameMessages(sendPrevious?: boolean, _player?: Player): ServerMessage[] {
    const msgs: ServerMessage[] = [];

    // nothing to send if game is not running
    if (!this.isRunning) {
      return msgs;
    }

    // directly return pause message if this is the end of the question and next question starts shortly...
    if (this.gamePhase === GamePhase.PAUSE_MUSIC) {
      msgs.push(this.getAudioControlMessage("pause"));
      return msgs;
    }

    const q = this.currentQuestion;

    // always send the current round message
    msgs.push(this.getRoundMessage(q?.getQuestionMessage(this.gamePhase)));

    // also always send the progressbar message
    msgs.push(this.getProgressBarUpdateMessage());

    if (q) {
      // also append previous audio control messages if requested
      for (let i = sendPrevious ? 0 : this.gamePhase; i <= this.gamePhase; i++) {
        switch (i) {
          case GamePhase.QUESTION:
            // ask to load audio of song to guess
            msgs.push(this.getAudioControlMessage("load", q.song!.audioURL));
            break;

          case GamePhase.ANSWERING:
            // ask to play already loaded song
            msgs.push(this.getAudioControlMessage("play"));
            break;
        }
      }
    }

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
        offset = this.questionTick - QUESTION_START_TICK - 1;
        break;
      case GamePhase.QUESTION:
        duration = -ROUND_PADDING_TICKS;
        offset = this.questionTick - QUESTION_PICKED_SONG_TICK - 1;
        break;
      case GamePhase.ANSWERING:
        duration = this.room.config.timePerQuestion;
        offset = this.questionTick - QUESTION_ANSWERING_TICK - 1;
        break;
      case GamePhase.ANSWER:
      case GamePhase.PAUSE_MUSIC:
        duration = 0;
        offset = this.questionTick - this.room.config.getQuestionShowAnswerTick() - 1;
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
        if (this.gamePhase !== GamePhase.ANSWERING) {
          player.sendRoomStateMessage();
          player.sendConfirmationOrError(msg, "Can only accept answers during questioning phase.");
          return true;
        } else if (player.answerData !== undefined && this instanceof MultipleChoiceGame) {
          player.sendRoomStateMessage();
          player.sendConfirmationOrError(msg, "You already selected an answer.");
          return true;
        } else if (this.room.config.gameMode === "multiple_choice" && msg.answerIndex === undefined) {
          player.sendRoomStateMessage();
          player.sendConfirmationOrError(msg, "You need to provide an answerIndex key.");
          return true;
        } else if (this.room.config.gameMode === "player_picks" && msg.answer === undefined) {
          player.sendRoomStateMessage();
          player.sendConfirmationOrError(msg, "You need to provide an answer key.");
          return true;
        }

        if (this.selectAnswer(player, msg))
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

        this.room.broadcastRoomStateMessage();
        return true;
    }

    return false;
  }

  onTick() {
    if (!this.isRunning)
      return;

    if (this.questionTick >= this.room.config.getQuestionStartNextTick()) {
      this.questionTick = QUESTION_START_TICK;
    }

    let gamePhaseChanged = false;
    switch (this.questionTick) {
      // allow picking question
      case QUESTION_START_TICK:
        // reset answer data of all players when a new round starts
        for (const [_, player] of this.room.players) {
          player.resetAnswerData();
        }

        if (this.currentQuestion || this.currentQuestionIndex < 0) {
          this.currentQuestionIndex++;
        }

        // next round starts when there is no picking phase or no question available
        if (!this.hasPickingPhase || !this.currentQuestion) {
          this.roundCurrent++;
        }

        if (this.roundCurrent > this.room.config.roundsCount) {
          this.endGame();
          return;
        }

        // skip to QUESTION_PICKED_SONG_TICK if questions don't need to be picked or a question is already available
        if (!this.hasPickingPhase || this.currentQuestion) {
          this.questionTick = QUESTION_PICKED_SONG_TICK;
          this.onTick();
          return;
        }

        gamePhaseChanged = true;
        this.gamePhase = GamePhase.PICKING;
        break;

      // show current question
      case QUESTION_PICKED_SONG_TICK:
        this.tryAddNextQuestions();

        // start new round if no one added a question in the picking phase
        if (!this.currentQuestion) {
          this.questionTick = QUESTION_START_TICK;
          this.onTick();
          return;
        }

        gamePhaseChanged = true;
        this.gamePhase = GamePhase.QUESTION;
        this.room.broadcastRoomStateMessage();
        break;

      // start music playback
      case QUESTION_ANSWERING_TICK:
        gamePhaseChanged = true;
        this.gamePhase = GamePhase.ANSWERING;
        this.questionStartTime = Date.now();
        break;

      // show results of current question
      case this.room.config.getQuestionShowAnswerTick():
        gamePhaseChanged = true;
        this.gamePhase = GamePhase.ANSWER;
        this.calculatePoints();

        this.room.broadcastRoomStateMessage();
        break;

      // pause music to allow fade out
      case this.room.config.getQuestionPauseMusicTick():
        gamePhaseChanged = true;
        this.gamePhase = GamePhase.PAUSE_MUSIC;
        break;
    }

    this.questionTick++;

    if (gamePhaseChanged) {
      this.onGamePhaseChanged();
      this.getGameMessages(this.gamePhase === GamePhase.QUESTION && this.room.config.gameMode === "player_picks")
        .forEach(msg => this.room.server.safeBroadcast(msg));
    }
  }

  /**
   * Called every time the game phase changed but before the game messages are sent.
   */
  public onGamePhaseChanged() { }

  /**
   * Provides the next questions that should be added to the list for the current round.
   */
  protected abstract getNextQuestions(): Question[];

  /**
   * Tries to add the next questions. Only adds questions if the current question is not set.
   * Ends the game if an error happend while adding questions.
   * @private
   * @see getNextQuestion
   */
  private tryAddNextQuestions() {
    try {
      if (!this.currentQuestion) {
        this.questions.push(...this.getNextQuestions());
      }
    } catch (e) {
      if (e instanceof InitError) {
        this.room.onlinePlayers.forEach((player: Player) => player.sendConfirmationOrError({ type: "other" }, e.message));
        this.room.server.logger.warn(e);
      } else {
        this.room.onlinePlayers.forEach((player: Player) => player.sendConfirmationOrError({ type: "other" }, "Unable to get next questions."));
        this.room.server.logger.error(e);
      }

      this.endGame();
    }
  }

  /**
   * Save timestamp and answer, when user selects an answer.
   *
   * @param player the player that selected an answer.
   * @param _msg the {@link SelectAnswerMessage} containing the selected answer.
   */
  public selectAnswer(player: Player, _msg: SelectAnswerMessage): boolean {
    const currentTime = Date.now();
    player.answerData = {
      answerSpeed: currentTime - this.questionStartTime,
      answerTimestamp: currentTime,
      questionPoints: 0,
    };

    return true;
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
   * @see {@link getNextQuestions}
   * @see {@link endGame}
   */
  public startGame() {
    this.room.server.logger.info("Starting game...");

    // always clear questions at start
    this.questions = [];

    // inform all players about the game start
    this.room.broadcastRoomStateMessage();

    this.room.startCountdown(3, () => {
      this.resetToLobby();
      this.room.state = "ingame";
      this.room.broadcastRoomStateMessage();

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
      this.room.broadcastRoomStateMessage();
      this.room.server.safeBroadcast(this.getPlayedSongsUpdateMessage());
    }
  }

  /**
   * Constructs a played songs update message with the songs played in the game.
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

    this.questionTick = QUESTION_START_TICK;
    this.currentQuestionIndex = -1;
    this.roundCurrent = 0;
    this.room.state = "lobby";

    // reset points of all players
    for (const [_, player] of this.room.players) {
      player.resetAnswerData(true);
    }
  }
}
