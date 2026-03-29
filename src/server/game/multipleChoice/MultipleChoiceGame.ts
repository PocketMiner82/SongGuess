import Game from "../Game";
import type {
  SelectAnswerMessage, Song
} from "../../../types/MessageTypes";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import {ROUND_POINTS_PER_QUESTION} from "../../../ConfigConstants";
import type Question from "../Question";
import type Player from "../../Player";


export class MultipleChoiceGame extends Game{
  /**
   * The list of questions for the current game.
   */
  questions: MultipleChoiceQuestion[] = [];


  createQuestion(song: Song): Question {
    return new MultipleChoiceQuestion(song, this.room.config);
  }

  selectAnswer(player: Player, msg: SelectAnswerMessage) {
    super.selectAnswer(player, msg);
    player.answerData!.answerIndex = msg.answerIndex;
  }

  calculatePoints() {
    for (let player of this.room.activePlayers) {
      if (player.answerData?.answerIndex === this.questions[this.currentQuestion].getCorrectAnswer()) {
        // half the points for correct answer
        player.points += ROUND_POINTS_PER_QUESTION / 2;

        // remaining points depend on speed of answer
        let factor = Math.max(0, (this.room.config.timePerQuestion * 1000 - (player.answerData.answerTimestamp - this.roundStartTime)))
            / (this.room.config.timePerQuestion * 1000);
        player.points += (ROUND_POINTS_PER_QUESTION / 2) * factor;

        player.points = Math.round(player.points);
      }
    }
  }
}