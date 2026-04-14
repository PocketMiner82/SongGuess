import Question from "../Question";
import type ServerConfig from "../../config/ServerConfig";
import type {AnswerMessage, QuestionMessage, Song} from "../../../types/MessageTypes";

export default class PlayerPicksQuestion extends Question {
  constructor(num: number, config: ServerConfig, private pickerId: string, song?: Song) {
    super(num, config, song);
  }

  getQuestionMessage(): QuestionMessage {
    let q = super.getQuestionMessage();
    q.pickerId = this.pickerId;
    return q;
  }

  getAnswerMessage(): AnswerMessage {
    let a = super.getAnswerMessage();
    a.correctSong = this.song;
    return a;
  }
}