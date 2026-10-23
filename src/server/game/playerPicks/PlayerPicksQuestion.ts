import type {
  PlayerPicksQuestionMessage,
  Song,
} from "../../../types/MessageTypes";
import type { PersistedPlayerPicksQuestion } from "../../../types/PersistedStateTypes";
import { GamePhase } from "../../../shared/game/GamePhase";
import { Question } from "../Question";


export class PlayerPicksQuestion extends Question {
  /**
   * The amount of questions shown. Must be set before getQuestionMessage is called.
   */
  public questionCount: number = -1;

  /**
   * @param questionCurrent current question number
   * @param pickerId picker uuid
   * @param song correct song
   */
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

  toStorage(): PersistedPlayerPicksQuestion {
    return {
      pickerId: this.pickerId,
      questionCurrent: this.questionCurrent,
      ...this.baseToStorage(),
    };
  }

  public static fromStorage(persistedQuestion: PersistedPlayerPicksQuestion): PlayerPicksQuestion {
    const q = new PlayerPicksQuestion(persistedQuestion.questionCurrent, persistedQuestion.pickerId, persistedQuestion.song);
    q.startPos = persistedQuestion.startPos;
    return q;
  }
}
