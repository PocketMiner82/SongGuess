import type {AnswerMessage, QuestionMessage, Song} from "../../types/MessageTypes";
import type ServerConfig from "../config/ServerConfig";
import _ from "lodash";

export default abstract class Question {
  /**
   * The random audio start position index (0-2) for this question.
   * @see RoomConfigMessageSchema.audioStartPosition
   */
  readonly rndStartPos: number = _.random(0, 2);

  /**
   * Constructs a question asking which is the correct song.
   *
   * @param num the question number.
   * @param config The room's config
   * @param song The correct song for this question.
   */
  constructor(readonly num: number, readonly config: ServerConfig, public song?: Song) { }

  /**
   * Creates a question message for sending to clients.
   *
   * @returns The question message.
   */
  getQuestionMessage(): QuestionMessage {
    return {
      type: "question",
      number: this.num,
      rndStartPos: this.rndStartPos
    };
  }

  /**
   * Creates an answer message for sending to clients.
   *
   * @returns The answer message.
   */
  getAnswerMessage(): AnswerMessage {
    return {
      type: "answer",
      number: this.num
    };
  }
}

/**
 * An exception informing the user about distraction generation errors.
 */
export class InitError extends Error {
  constructor(error: string) {
    super(`Question initialization failed: ${error}`);
  }
}