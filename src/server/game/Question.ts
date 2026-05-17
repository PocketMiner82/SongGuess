import type GamePhase from "../../shared/game/GamePhase";
import type {
  QuestionMessage,
  Song,
} from "../../types/MessageTypes";
import _ from "lodash";


export default abstract class Question {
  /**
   * The random/user-defined audio start position index (0-2) for this question.
   * @see RoomConfigMessageSchema.audioStartPosition
   */
  startPos: number = _.random(0, 2);


  /**
   * Constructs a question asking which is the correct song.
   *
   * @param song The correct song for this question.
   */
  protected constructor(readonly song: Song) { }

  /**
   * Returns the round message for the current phase.
   * @param gamePhase the current game phase
   */
  abstract getQuestionMessage(gamePhase: GamePhase): QuestionMessage;
}

/**
 * An exception informing the user about distraction generation errors.
 */
export class InitError extends Error {
  constructor(error: string) {
    super(`Question initialization failed: ${error}`);
  }
}
