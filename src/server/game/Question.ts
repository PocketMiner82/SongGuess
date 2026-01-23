import type {AnswerMessage, QuestionMessage, Song} from "../../types/MessageTypes";
import type ServerConfig from "../config/ServerConfig";

export default abstract class Question {
  /**
   * The list of songs for this question (1 correct answer + 3 distractors).
   */
  questions: Song[] = [];

  /**
   * Constructs a question asking which is the correct song.
   * After all questions are added, {@link init} MUST be called.
   *
   * @param song The correct song for this question.
   * @param config The room's config
   */
  constructor(readonly song: Song, readonly config: ServerConfig) {
    this.questions.push(song);
  }

  /**
   * Initializes this question. MUST be called AFTER all questions are added.
   * @param remainingSongs can contain all songs that were not yet added. Needed for {@link MultipleChoiceQuestion}s.
   */
  abstract init(remainingSongs?: Song[]): void;

  /**
   * Should return the correct answer index.
   */
  abstract getCorrectAnswer(): number;

  /**
   * Extracts song names from the questions array.
   *
   * @returns An array of song names for the answer options.
   */
  getSongNames() {
    return this.questions.map(s => s.name);
  }

  /**
   * Creates a question message for sending to clients.
   *
   * @param n The question number.
   * @returns A JSON string containing the question message.
   */
  getQuestionMessage(n: number): string {
    let questionMsg: QuestionMessage = {
      type: "question",
      number: n,
      answerOptions: this.getSongNames()
    }
    return JSON.stringify(questionMsg);
  }

  /**
   * Creates an answer message for sending to clients.
   *
   * @param n The question number.
   * @returns A JSON string containing the answer message.
   */
  getAnswerMessage(n: number): string {
    let answerMsg: AnswerMessage = {
      type: "answer",
      number: n,
      answerOptions: this.getSongNames(),
      correctAnswer: this.getCorrectAnswer()
    }
    return JSON.stringify(answerMsg);
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