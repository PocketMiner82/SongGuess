import type { MultipleChoiceQuestionMessage, Song } from "../../../types/MessageTypes";
import type { PersistedMultipleChoiceQuestion } from "../../../types/PersistedStateTypes";
import _ from "lodash";
import { GamePhase } from "../../../shared/game/GamePhase";
import { InitError, Question } from "../Question";


export class MultipleChoiceQuestion extends Question {
  /**
   * The list of songs for this question (1 correct answer + 3 distractors).
   */
  answers: Song[] = [];

  /**
   * Constructs a mulitple choice question asking which is the correct song.
   *
   * @param song The correct song for this question.
   * @param possibleDistractions all possible songs that could be used for distractions
   * @param distractionsPreferSameArtist whether to prefer searching for distractions by the same artist as the searched song
   */
  constructor(song: Song, possibleDistractions: Song[] | null, readonly distractionsPreferSameArtist: boolean | null) {
    super(song);
    if (possibleDistractions) {
      this.answers.push(song);
      this.generateDistractions(possibleDistractions);
    }
  }

  /**
   * Adds 3 random distraction songs to the question and shuffles all options.
   *
   * @param possibleDistractions Array of songs to use as distraction options. Will be copied, so no items are removed.
   * @throws Error if distraction generation fails.
   */
  private generateDistractions(possibleDistractions: Song[]) {
    possibleDistractions = _.shuffle(possibleDistractions.filter(s => s.name !== this.song!.name));
    let distractions = possibleDistractions;

    if (this.distractionsPreferSameArtist) {
      // filters for songs that share at least one artist with the current track
      distractions = possibleDistractions.filter(s =>
        this.song!.artist.split(" & ")
          .some(a => s.artist.split(" & ").includes(a)));

      // if no distractions were found, attempt to use songs as distractions which artist also appears only once
      if (distractions.length === 0) {
        const artistCounts = new Map();

        possibleDistractions.forEach((s) => {
          s.artist.split(" & ").forEach(a =>
            artistCounts.set(a, (artistCounts.get(a) || 0) + 1));
        });

        distractions = possibleDistractions.filter(s =>
          s.artist.split(" & ").every(a => artistCounts.get(a) === 1));
      }

      // add all other distractions as fallback if there are not enough distractions available
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

  toStorage(): PersistedMultipleChoiceQuestion {
    return {
      answers: this.answers,
      ...this.baseToStorage(),
    };
  }

  public static fromStorage(persistedQuestion: PersistedMultipleChoiceQuestion): MultipleChoiceQuestion {
    const q = new MultipleChoiceQuestion(persistedQuestion.song, null, null);
    q.answers = persistedQuestion.answers;
    q.startPos = persistedQuestion.startPos;

    return q;
  }
}
