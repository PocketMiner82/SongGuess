import type {
  SelectAnswerMessage,
  Song,
} from "../../../types/MessageTypes";
import type Player from "../../Player";
import type Question from "../Question";
import _ from "lodash";
import { POINTS_PER_QUESTION } from "../../../shared/ConfigConstants";
import Game from "../Game";
import MultipleChoiceQuestion from "./MultipleChoiceQuestion";


export class MultipleChoiceGame extends Game {
  hasPickingPhase: boolean = false;

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
  protected getNextQuestions(): Question[] {
    if (this.remainingSongs.length === 0) {
      this.remainingSongs = _.shuffle(this.room.lobby.songs);
    }

    const q = new MultipleChoiceQuestion(
      this.remainingSongs.pop()!,
      this.room.lobby.songs,
      this.room.config.distractionsPreferSameArtist,
    );

    let output = `Generated MultipleChoiceQuestion ${this.questions.length}:`;
    output += `  Solution: ${q.song!.name} by ${q.song!.artist}\n`;
    output += "  All answers: ";
    output += q.answers.map(q => `${q.name} by ${q.artist}`).join("; ");
    output += "\n";
    this.room.server.logger.info(output);

    return [q];
  }

  selectAnswer(player: Player, msg: SelectAnswerMessage) {
    const ret = super.selectAnswer(player, msg);

    if (ret) {
      player.answerData!.answerIndex = msg.answerIndex;

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
          this.questionTick = this.room.config.getQuestionShowAnswerTick();
        }
      }
    }

    return ret;
  }

  calculatePoints() {
    for (const player of this.room.activePlayers) {
      if (player.answerData?.answerIndex === (this.currentQuestion as MultipleChoiceQuestion).getCorrectAnswer()) {
        // half the points for correct answer
        player.answerData.questionPoints = POINTS_PER_QUESTION / 2;
        // remaining points depend on speed of answer
        player.answerData.questionPoints += this.getTimePoints(player);

        player.answerData.questionPoints = Math.round(player.answerData.questionPoints);
        player.points += player.answerData.questionPoints;
      }
    }
  }
}
