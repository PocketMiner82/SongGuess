import type { ClientMessage, SelectAnswerMessage } from "../../../types/MessageTypes";
import type Player from "../../Player";
import type Question from "../Question";
import { distance } from "fastest-levenshtein";
import { POINTS_PER_QUESTION, QUESTION_PICKED_SONG_TICK } from "../../../shared/ConfigConstants";
import GamePhase from "../../../shared/game/GamePhase";
import { normalizeSongName } from "../../../shared/Utils";
import Game from "../Game";
import PlayerPicksQuestion from "./PlayerPicksQuestion";


export class PlayerPicksGame extends Game {
  hasPickingPhase: boolean = true;

  /**
   * The list of questions for the current game.
   */
  questions: PlayerPicksQuestion[] = [];

  /**
   * List of the questions selected by players during picking phase.
   */
  nextQuestions: PlayerPicksQuestion[] = [];

  /**
   * List of all players still needing to pick a song.
   */
  get remainingPickers(): Player[] {
    return this.room.activePlayers.filter(player =>
      this.nextQuestions.every(q =>
        q.pickerId !== player.uuid));
  }

  protected getNextQuestions(): Question[] {
    // penality of max points per round for players that did not pick a song
    for (const player of this.remainingPickers) {
      player.points -= 1000;
    }

    for (const q of this.nextQuestions) {
      q.questionCount = this.nextQuestions.length;
    }

    return this.nextQuestions;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    const ret = super.onMessage(player, msg);

    if (msg.type === "player_pick_song") {
      if (this.gamePhase !== GamePhase.PICKING) {
        player.sendConfirmationOrError(msg, "Can only pick songs during picking phase.");
        return true;
      }

      const newQuestion = new PlayerPicksQuestion(
        this.nextQuestions.length + 1,
        player.uuid,
        msg.song,
      );
      newQuestion.startPos = msg.startPos;

      this.nextQuestions.push(newQuestion);

      // if every player has picked a song, continue to picked phase
      if (this.remainingPickers.length === 0) {
        this.questionTick = QUESTION_PICKED_SONG_TICK;
      }
      return true;
    }

    return ret;
  }

  onGamePhaseChanged() {
    if (this.gamePhase === GamePhase.PICKING) {
      this.nextQuestions = [];
    }

    super.onGamePhaseChanged();
  }

  selectAnswer(player: Player, msg: SelectAnswerMessage) {
    const ret = super.selectAnswer(player, msg);
    if (player.uuid === (this.currentQuestion as PlayerPicksQuestion).pickerId) {
      player.sendConfirmationOrError(msg, "The picker of a question is not allowed to guess.");
      return false;
    }

    if (ret) {
      player.answerData!.answer = msg.answer!;
    }

    return ret;
  }

  /**
   * Core scoring logic that calculates points based on string similarity.
   * @remarks
   * Uses Levenshtein distance to determine how close the player's answer is to the source.
   * A minimum similarity of 40% is required to score. Points are scaled linearly
   * from 40% (0 points) to 100% (max points).
   * @param correctAnswer - The normalized ground-truth string.
   * @param playerAnswer - The normalized player-submitted string.
   * @returns A score ranging from 0 to half of {@link POINTS_PER_QUESTION}.
   */
  private getPointsByDistance(correctAnswer: string, playerAnswer: string) {
    if (!correctAnswer) {
      return 0;
    }

    const levenshteinDist = distance(playerAnswer, correctAnswer);
    const similarity = 1 - (levenshteinDist / correctAnswer.length);

    // answer must be at least 40% correct to be counted
    if (similarity >= 0.4) {
      // scale 0-500 points linear with 40% - 100% similarity; will be at max half the points
      return ((similarity - 0.4) / 0.6) * (POINTS_PER_QUESTION / 2);
    }
    return 0;
  }

  /**
   * Calculates points based on the similarity of the "base" song title,
   * effectively ignoring any parenthetical metadata of the solution like "(feat. Artist)" or "[Live]".
   * @param player - The player object containing the submitted answer data.
   * @see this.getPointsByDistance
   * @returns A score between 0 and 50% of the maximum round points.
   */
  private getPointsWithoutParens(player: Player) {
    // check for partial correctness (ignoring parens at end)
    const playerAnswer = normalizeSongName(player.answerData!.answer ?? "", false);
    const correctAnswer = normalizeSongName(this.currentQuestion!.song!.name, true);

    return this.getPointsByDistance(correctAnswer, playerAnswer);
  }

  /**
   * Calculates points based on the similarity of the full song title,
   * including all parenthetical metadata and extra descriptors.
   * @param player - The player object containing the submitted answer data.
   * @see this.getPointsByDistance
   * @returns A score between 0 and 50% of the maximum round points.
   */
  private getPointsWithParens(player: Player) {
    const playerAnswer = normalizeSongName(player.answerData!.answer ?? "", false);
    const correctAnswer = normalizeSongName(this.currentQuestion!.song!.name, false);

    return this.getPointsByDistance(correctAnswer, playerAnswer);
  }

  calculatePoints() {
    for (const player of this.room.activePlayers) {
      if (player.answerData) {
        const withParens = this.getPointsWithParens(player);
        const withoutParens = this.getPointsWithoutParens(player);

        if (withoutParens >= withParens) {
          player.answerData.questionPoints = withoutParens;
        } else {
          // including stuff from parens gives even more points
          player.answerData.questionPoints = withParens * 2;
        }
      }

      if (player.answerData?.questionPoints) {
        // other half of points depends on time the player needed to answer
        player.answerData!.questionPoints += this.getTimePoints(player);

        player.answerData!.questionPoints = Math.round(player.answerData!.questionPoints);
        player.points += player.answerData!.questionPoints;
      }
    }
  }
}
