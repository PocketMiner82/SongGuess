import type { AnswerMessage, QuestionMessage, Song } from "../../../types/MessageTypes";
import type ServerConfig from "../../config/ServerConfig";
import Question from "../Question";


export default class PlayerPicksQuestion extends Question {
  isPickingPhase = true;

  constructor(num: number, config: ServerConfig, public pickerId: string, song?: Song) {
    super(num, config, song);
  }

  getQuestionMessage(): QuestionMessage {
    const q = super.getQuestionMessage();
    q.pickerId = this.pickerId;
    q.isPickingPhase = this.isPickingPhase;
    return q;
  }

  getAnswerMessage(): AnswerMessage {
    const a = super.getAnswerMessage();
    a.correctSong = this.song;
    return a;
  }
}
