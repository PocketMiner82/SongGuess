import type { AnswerMessage, QuestionMessage, Song } from "../../../types/MessageTypes";
import type ServerConfig from "../../config/ServerConfig";
import Question from "../Question";


export default class PlayerPicksQuestion extends Question {
  constructor(num: number, config: ServerConfig, public pickerId: string | null, song?: Song) {
    super(num, config, song);
  }

  getQuestionMessage(): QuestionMessage {
    const q = super.getQuestionMessage();
    q.pickerId = this.pickerId;
    return q;
  }

  getAnswerMessage(): AnswerMessage {
    const a = super.getAnswerMessage();
    a.correctSong = this.song;
    return a;
  }
}
