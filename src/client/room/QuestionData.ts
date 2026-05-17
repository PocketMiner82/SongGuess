import type { RoundStateMessage, Song } from "../../types/MessageTypes";


export class QuestionData {
  /**
   * The round message, containing most important info
   */
  roundMsg?: RoundStateMessage;

  /**
   * The currently selected answer index.
   */
  selectedAnswerIndex?: number;

  /**
   * The currently selected answer string.
   */
  selectedAnswer?: string;

  /**
   * The random/user-defined audio start position index (0-2) for the question.
   * @see RoomConfigMessageSchema.audioStartPosition
   */
  audioStartPos: number = 0;

  /**
   * The duration where the progress bar should start.
   */
  progressbarDuration: number = 0;

  /**
   * The offset position for the progress bar.
   */
  progressbarOffset: number = 0;

  /**
   * Whether the player has already picked a song this round.
   */
  pickedSong: Song | null = null;
}
