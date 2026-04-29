import type { MultipleChoiceQuestionMessage, Song } from "../../../types/MessageTypes";
import _ from "lodash";
import GamePhase from "../../../shared/game/GamePhase";
import Question, { InitError } from "../Question";


export default class MultipleChoiceQuestion extends Question {
  /**
   * The list of songs for this question (1 correct answer + 3 distractors).
   */
  answers: Song[] = [];

  /**
   * Constructs a mulitple choice question asking which is the correct song.
   *
   * @param roundCurrent the current round number.
   * @param song The correct song for this question.
   * @param possibleDistractions all possible songs that could be used for distractions
   * @param distractionsPreferSameArtist whether to prefer searching for distractions by the same artist as the searched song
   */
  constructor(song: Song, possibleDistractions: Song[], readonly distractionsPreferSameArtist: boolean) {
    super(song);
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

    if (this.distractionsPreferSameArtist) {
      // filters for songs that share at least one artist with the current track
      distractions = possibleDistractions.filter(s =>
        this.song!.artist.split(" & ")
          .some(a => s.artist.split(" & ").includes(a)));

      // add all other distractions as fallback if there are not enough distractions available by the same artist
      distractions.push(..._.difference(possibleDistractions, distractions));
    }

    for (let i = 0; i < 3; i++) {
      const distraction = distractions[i];

      if (!distraction) {
        throw new InitError("Cannot find enough distractions with different name. "
          + "Please add more songs with unique names to the playlist!");
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

  getQuestionMessage(gamePhase: GamePhase): MultipleChoiceQuestionMessage {
    return {
      questionType: "multiple_choice",
      answerOptions: this.getSongNames(),
      correctAnswerIndex: gamePhase === GamePhase.ANSWER ? this.getCorrectAnswer() : undefined,
      startPos: this.startPos,
    };
  }
}
