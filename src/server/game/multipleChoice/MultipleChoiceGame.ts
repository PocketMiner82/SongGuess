import Game from "../Game";
import type * as Party from "partykit/server";
import type {
  PlayerState,
  SelectAnswerMessage, Song
} from "../../../types/MessageTypes";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import {POINTS_PER_QUESTION, TIME_PER_QUESTION} from "../../config/ServerConfigConstants";
import type Question from "../Question";


export class MultipleChoiceGame extends Game{
  /**
   * The list of questions for the current game.
   */
  questions: MultipleChoiceQuestion[] = [];


  createQuestion(song: Song): Question {
    return new MultipleChoiceQuestion(song, this.room.config);
  }

  selectAnswer(conn: Party.Connection, msg: SelectAnswerMessage) {
    let playerState: PlayerState = conn.state as PlayerState;
    playerState.answerIndex = msg.answerIndex;
    super.selectAnswer(conn, msg);
  }

  calculatePoints() {
    for (let conn of this.room.getPartyRoom().getConnections()) {
      let connState = conn.state as PlayerState;

      if (connState.answerTimestamp && connState.answerIndex === this.questions[this.currentQuestion].getCorrectAnswer()) {
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
}