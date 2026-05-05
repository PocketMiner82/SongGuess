import type {
  PlayerPicksQuestionMessage,
  Song,
} from "../../../types/MessageTypes";
import GamePhase from "../../../shared/game/GamePhase";
import Question from "../Question";


export default class PlayerPicksQuestion extends Question {
  /**
   * The amount of questions shown. Must be set before getQuestionMessage is called.
   */
  public questionCount: number = -1;

  constructor(readonly questionCurrent: number, public pickerId: string, song: Song) {
    super(song);
  }

  getQuestionMessage(gamePhase: GamePhase): PlayerPicksQuestionMessage {
    if (this.questionCount === -1) {
      throw new Error("questionCount must be set before calling getQuestionMessage()");
    }

    return {
      questionType: "player_picks",
      questionCurrent: this.questionCurrent,
      questionCount: this.questionCount,
      correctAnswer: gamePhase === GamePhase.ANSWER ? this.song : undefined,
      pickerId: this.pickerId,
      startPos: this.startPos,
    };
  }
}
