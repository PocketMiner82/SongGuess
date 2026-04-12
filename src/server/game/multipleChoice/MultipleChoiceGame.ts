import Game from "../Game";
import type {
  SelectAnswerMessage, Song
} from "../../../types/MessageTypes";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";
import {ROUND_POINTS_PER_QUESTION} from "../../../ConfigConstants";
import type Question from "../Question";
import type Player from "../../Player";
import _ from "lodash";


export class MultipleChoiceGame extends Game {
  /**
   * The list of questions for the current game.
   */
  questions: MultipleChoiceQuestion[] = [];

  /**
   * A list of songs still available for use in the next round.
   * This pool is used to avoid repeating songs within a single game session.
   */
  remainingSongs: Song[] = [];


  /**
   * Creates a random question for the next round.
   */
  protected getNextQuestion(): Question {
    if (this.remainingSongs.length === 0) {
      this.remainingSongs = _.shuffle(this.room.lobby.songs);
    }

    let q = new MultipleChoiceQuestion(
        this.currentQuestion + 1,
        this.remainingSongs.pop()!,
        this.room.config,
        this.room.lobby.songs
    );

    let output = `Generated MultipleChoiceQuestion ${q.num}:`;
    output += `  Solution: ${q.song!.name} by ${q.song!.artist}\n`;
    output += "  All answers: ";
    output += q.answers.map(q => `${q.name} by ${q.artist}`).join("; ");
    output += "\n";
    this.room.server.logger.info(output);

    return q;
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