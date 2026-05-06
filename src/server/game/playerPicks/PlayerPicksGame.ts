import type { ClientMessage, ConfirmationMessage, SelectAnswerMessage, ServerMessage } from "../../../types/MessageTypes";
import type Player from "../../Player";
import type Question from "../Question";
import { ratio, token_set_ratio } from "fuzzball";
import { POINTS_PER_QUESTION } from "../../../shared/ConfigConstants";
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
   * Map of the questions selected by players during picking phase. Key is player uuid.
   */
  nextQuestions: Map<string, PlayerPicksQuestion> = new Map();

  /**
   * List of all players still needing to pick a song.
   */
  get remainingPickers(): Player[] {
    return this.room.activePlayers.filter(player =>
      Array.from(this.nextQuestions.values()).every(q =>
        q.pickerId !== player.uuid));
  }

  getGameMessages(sendPrevious?: boolean, player?: Player): ServerMessage[] {
    const msgs = super.getGameMessages(sendPrevious);

    // add the picked song to the game messages - if exists
    if (player && this.nextQuestions.has(player.uuid) && this.gamePhase === GamePhase.PICKING) {
      msgs.push({
        type: "confirmation",
        sourceMessage: {
          type: "player_pick_song",
          song: this.nextQuestions.get(player.uuid)!.song,
          startPos: this.nextQuestions.get(player.uuid)!.startPos,
        },
      } satisfies ConfirmationMessage);
    }

    return msgs;
  }


  protected getNextQuestions(): Question[] {
    // penality of max points per question for players that did not pick a song
    for (const player of this.remainingPickers) {
      player.points -= POINTS_PER_QUESTION;
    }

    const nextQ: PlayerPicksQuestion[] = Array.from(this.nextQuestions.values());

    for (const q of nextQ) {
      q.questionCount = this.nextQuestions.size;
    }

    return nextQ;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    const ret = super.onMessage(player, msg);

    if (msg.type === "player_pick_song") {
      if (this.gamePhase !== GamePhase.PICKING) {
        player.sendConfirmationOrError(msg, "Can only pick songs during picking phase.");
        return true;
      } else if (this.nextQuestions.has(player.uuid)) {
        player.sendConfirmationOrError(msg, "You cannot change your picked song.");
        return true;
      }

      const newQuestion = new PlayerPicksQuestion(
        this.nextQuestions.size + 1,
        player.uuid,
        msg.song,
      );
      newQuestion.startPos = msg.startPos;

      this.nextQuestions.set(player.uuid, newQuestion);

      // if every player has picked a song, continue to picked phase
      if (this.remainingPickers.length === 0) {
        this.questionTick = this.room.config.getQuestionPickedSongTick();
      }

      player.sendConfirmationOrError(msg);
      return true;
    }

    return ret;
  }

  onGamePhaseChanged() {
    if (this.gamePhase === GamePhase.PICKING) {
      this.nextQuestions = new Map();
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
   * A minimum similarity of 75% is required to score. Points are scaled linearly using the similarity from 75% to 100%.
   * @param correctAnswer - The normalized ground-truth string.
   * @param playerAnswer - The normalized player-submitted string.
   * @param avgWithTokenSetRatio - `true`: average the levenshtein ratio with the token set ratio in the calculation.
   *                               will also scale the similarity based on the length of the target string, being more
   *                               forgiving with longer target strings.
   *                               `false`: only use levenshtein.
   * @returns A score ranging from 0 to half of {@link POINTS_PER_QUESTION}.
   */
  private getPointsByDistance(correctAnswer: string, playerAnswer: string, avgWithTokenSetRatio: boolean) {
    if (!correctAnswer) {
      return 0;
    }

    // stricter
    const rat = ratio(correctAnswer, playerAnswer, {
      full_process: false,
    });

    let similarity: number;
    if (avgWithTokenSetRatio) {
      // more forgiving
      const tokenSetRatio = token_set_ratio(correctAnswer, playerAnswer, {
        full_process: false,
      });

      // scale the similarity based on the length of the target string.
      // if the target string gets, very long, be more forgiving.
      const cappedLen = Math.min(correctAnswer.length, 100);
      const weight = cappedLen / 100;

      similarity = (1 - weight) * rat + weight * tokenSetRatio;
    } else {
      similarity = rat;
    }

    if (similarity >= 75) {
      // scale up to half the points per question linearly with 75% - 100% similarity but don't be zero
      return Math.max(1, ((similarity - 75) / 25) * (POINTS_PER_QUESTION / 2));
    }
    return 0;
  }

  /**
   * Calculates points based on the similarity of the "base" song title,
   * effectively ignoring any parenthetical metadata of the solution like "(feat. Artist)" or "[Live]".
   * Gets more forgiving the longer the target string.
   * @param player - The player object containing the submitted answer data.
   * @see this.getPointsByDistance
   * @returns A score between 0 and 50% of the maximum round points.
   */
  private getPointsWithoutParens(player: Player) {
    // check for partial correctness (ignoring parens at end)
    const playerAnswer = normalizeSongName(player.answerData?.answer ?? "", false);
    const correctAnswer = normalizeSongName(this.currentQuestion!.song!.name, true);

    return this.getPointsByDistance(correctAnswer, playerAnswer, true);
  }

  /**
   * Calculates points based on the similarity of the full song title,
   * including all parenthetical metadata and extra descriptors.
   * @param player - The player object containing the submitted answer data.
   * @see this.getPointsByDistance
   * @returns A score between 0 and 50% of the maximum round points.
   */
  private getPointsWithParens(player: Player) {
    const playerAnswer = normalizeSongName(player.answerData?.answer ?? "", false);
    const correctAnswer = normalizeSongName(this.currentQuestion!.song!.name, false);

    // do not use token set ratio for this, as points with parens should
    // only give bonus points if player typed song title AND parens almost perfectly
    return this.getPointsByDistance(correctAnswer, playerAnswer, false);
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
