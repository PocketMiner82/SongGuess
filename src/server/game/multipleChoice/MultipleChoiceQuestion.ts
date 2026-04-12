import type {AnswerMessage, QuestionMessage, Song} from "../../../types/MessageTypes";
import Question, {InitError} from "../Question";
import _ from "lodash";
import type ServerConfig from "../../config/ServerConfig";

export default class MultipleChoiceQuestion extends Question {
  /**
   * The list of songs for this question (1 correct answer + 3 distractors).
   */
  answers: Song[] = [];


  /**
   * Constructs a mulitple choice question asking which is the correct song.
   *
   * @param num the question number.
   * @param song The correct song for this question.
   * @param config The room's config
   * @param possibleDistractions all possible songs that could be used for distractions
   */
  constructor(num: number, song: Song, config: ServerConfig, possibleDistractions: Song[]) {
    super(num, config, song);
    this.answers.push(song);
    this.generateDistractions(possibleDistractions);
  }

  /**
   * Adds 3 random distraction songs to the question and shuffles all options.
   *
   * @param possibleDistractions Array of songs to use as distraction options. Will be copied, so no items are removed.
   * @throws Error if distraction generation fails.
   */
  private generateDistractions(possibleDistractions: Song[]) {
    possibleDistractions = _.shuffle(possibleDistractions.filter(s =>
      s.audioURL !== this.song!.audioURL && s.name !== this.song!.name));
    let distractions = possibleDistractions;

    if (this.config.distractionsPreferSameArtist) {
      // filters for songs that share at least one artist with the current track
      distractions = possibleDistractions.filter(s =>
          this.song!.artist.split(" & ")
              .some(a => s.artist.split(" & ").indexOf(a) !== -1));

      // add all other distractions as fallback if there are not enough distractions available by the same artist
      distractions.push(..._.difference(possibleDistractions, distractions));
    }

    for (let i = 0; i < 3; i++) {
      let distraction = distractions[i];

      if (!distraction) {
        throw new InitError("Cannot find enough distractions with different name. " +
            "Please add more songs with unique names to the playlist!");
      }

      this.answers.push(distraction);
    }
    this.answers = _.shuffle(this.answers);
  }

  /**
   * Extracts song names from the questions array.
   *
   * @returns An array of song names for the answer options.
   */
  getSongNames() {
    return this.answers.map(s => s.name);
  }

  /**
   * Returns the correct answer index.
   */
  getCorrectAnswer() {
    return this.answers.indexOf(this.song!);
  }

  getQuestionMessage(): QuestionMessage {
    let q = super.getQuestionMessage();
    q.answerOptions = this.getSongNames();
    return q;
  }

  getAnswerMessage(): AnswerMessage {
    let a = super.getAnswerMessage();
    a.answerOptions = this.getSongNames();
    a.correctIndex = this.getCorrectAnswer();
    return a;
  }
}