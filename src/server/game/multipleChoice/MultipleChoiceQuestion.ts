import type {Song} from "../../../types/MessageTypes";
import Question, {InitError} from "../Question";
import _ from "lodash";

export default class MultipleChoiceQuestion extends Question {

  init(remainingSongs?: Song[]) {
    if (remainingSongs) {
      this.generateDistractions(remainingSongs);
    }
  }

  /**
   * Adds 3 random distraction songs to the question and shuffles all options.
   *
   * @param possibleDistractions Array of songs to use as distraction options. Will be copied, so no items are removed.
   * @throws Error if distraction generation fails.
   */
  private generateDistractions(possibleDistractions: Song[]) {
    possibleDistractions = _.shuffle(possibleDistractions.filter(s =>
      s.audioURL !== this.song.audioURL && s.name !== this.song.name));
    let distractions = possibleDistractions;

    if (this.config.distractionsPreferSameArtist) {
      distractions = possibleDistractions.filter(s => s.artist === this.song.artist);
      distractions.push(..._.difference(possibleDistractions, distractions));
    }

    for (let i = 0; i < 3; i++) {
      let distraction = distractions[i];

      if (!distraction) {
        throw new InitError("Cannot find enough distractions with different name. " +
            "Please add more songs with unique names to the playlist!");
      }

      this.questions.push(distraction);
    }
    this.questions = _.shuffle(this.questions);
  }

  getCorrectAnswer() {
    return this.questions.indexOf(this.song);
  }
}