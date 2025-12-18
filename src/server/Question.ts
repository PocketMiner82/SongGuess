import type { Song } from "../schemas/RoomSharedMessageSchemas";
import { shuffle } from "../Utils";
import type { AnswerMessage, QuestionMessage } from "../schemas/RoomServerMessageSchemas";

export default class Question {
  questions: Song[] = [];

  /**
   * Constructs a question asking which is the correct song.
   * After all questions are added, {@link generateDistractions} MUST be called to add the distraction answers.
   * 
   * @param song The correct song for this question.
   */
  constructor(readonly song: Song) {
    this.questions.push(song);
  }

  public generateDistractions(possibleDistractions: Song[]) {
    for (let i = 0; i < 3; i++) {
      let randomIndex = Math.floor(Math.random() * possibleDistractions.length);
      this.questions.push(possibleDistractions.splice(randomIndex, 1)[0]);
    }
    this.questions = shuffle(this.questions);
  }

  private getSongNames() {
    let songNames = this.questions.map(s => s.name);

    if (songNames.length !== 4) {
      throw new Error("Please call generateDistractions() first.");
    }

    return songNames;
  }

  public getQuestionMessage(n: number): string {
    let questionMsg: QuestionMessage = {
      type: "question",
      number: n,
      answerOptions: this.getSongNames()
    }
    return JSON.stringify(questionMsg);
  }

  public getAnswerMessage(n: number): string {
    let answerMsg: AnswerMessage = {
      type: "answer",
      number: n,
      answerOptions: this.getSongNames(),
      correctAnswer: this.questions.indexOf(this.song)
    }
    return JSON.stringify(answerMsg);
  }
}