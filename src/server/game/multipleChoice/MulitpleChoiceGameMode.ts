import GameMode from "../GameMode";
import type * as Party from "partykit/server";
import type {Connection} from "partykit/server";
import type {
  ClientMessage,
  PlayerState,
  SelectAnswerMessage,
  UpdatePlayedSongsMessage
} from "../../../types/MessageTypes";
import MultipleChoiceQuestion, {DistractionError} from "./MultipleChoiceQuestion";
import {POINTS_PER_QUESTION, TIME_PER_QUESTION} from "../../config/ServerConfigConstants";
import GamePhase from "../GamePhase";


export class MulitpleChoiceGameMode extends GameMode{
  /**
   * The list of questions for the current game.
   */
  questions: MultipleChoiceQuestion[] = [];


  onMessage(conn: Connection, msg: ClientMessage): boolean {
    if (super.onMessage(conn, msg)) {
      return true;
    }

    switch (msg.type) {
      case "start_game":
        // make sure setting distractions worked
        try {
          this.regenerateRandomQuestions();
        } catch (e) {
          if (this.room.hostConnection && e instanceof DistractionError) {
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
    }

    return super.onMessage(conn, msg);
  }

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

  selectAnswer(conn: Party.Connection, msg: SelectAnswerMessage) {
    let playerState: PlayerState = conn.state as PlayerState;
    playerState.answerIndex = msg.answerIndex;
    super.selectAnswer(conn, msg);
  }

  calculatePoints() {
    for (let conn of this.room.getPartyRoom().getConnections()) {
      let connState = conn.state as PlayerState;

      if (connState.answerTimestamp && connState.answerIndex === this.questions[this.currentQuestion].getAnswerIndex()) {
        // half the points for correct answer
        connState.points += POINTS_PER_QUESTION / 2;

        // remaining points depend on speed of answer
        let factor = Math.max(0, (TIME_PER_QUESTION * 1000 - (connState.answerTimestamp - this.roundStartTime)))
            / (TIME_PER_QUESTION * 1000);
        connState.points += (POINTS_PER_QUESTION / 2) * factor;

        connState.points = Math.round(connState.points);

        conn.setState(connState);
      }
    }
  }

  endGame(sendUpdate: boolean = true) {
    super.endGame(sendUpdate);

    if (sendUpdate) {
      this.room.getPartyRoom().broadcast(this.getPlayedSongsUpdateMessage());
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
        this.remainingSongs = this.room.songs.filter(song => !usedAudioUrls.has(song.audioURL));
      }

      let randomIndex = Math.floor(Math.random() * this.remainingSongs.length);
      this.questions.push(new MultipleChoiceQuestion(this.remainingSongs.splice(randomIndex, 1)[0]))
    }

    // add distractions to the questions
    for (const q of this.questions) {
      q.generateDistractions(this.room.songs);
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
}