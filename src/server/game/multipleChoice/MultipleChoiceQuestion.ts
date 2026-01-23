import { shuffle } from "../../../Utils";
import type {Song} from "../../../types/MessageTypes";
import Question, {InitError} from "../Question";

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
    const distractions = possibleDistractions.filter(s =>
      s.audioURL !== this.song.audioURL);

    for (let i = 0; i < 3; i++) {
      let randomIndex = Math.floor(Math.random() * distractions.length);
      let distraction = distractions.splice(randomIndex, 1)[0];

      if (!distraction) {
        throw new InitError("Cannot find enough distractions with different name. " +
            "Please add more songs with unique names to the playlist!");
      } else if (distraction.name === this.song.name) {
        // try again
        i--;
        continue;
      }

      this.questions.push(distraction);
    }
    this.questions = shuffle(this.questions);
  }

  getCorrectAnswer() {
    return this.questions.indexOf(this.song);
  }
}