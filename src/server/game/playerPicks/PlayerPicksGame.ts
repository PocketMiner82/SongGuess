import type { ClientMessage, SelectAnswerMessage } from "../../../types/MessageTypes";
import type Player from "../../Player";
import type Question from "../Question";
import { distance } from "fastest-levenshtein";
import { ROUND_PICKED_SONG_TICK, ROUND_POINTS_PER_QUESTION } from "../../../ConfigConstants";
import { normalizeSongName } from "../../../Utils";
import Game from "../Game";
import GamePhase from "../GamePhase";
import PlayerPicksQuestion from "./PlayerPicksQuestion";


export class PlayerPicksGame extends Game {
  /**
   * The list of questions for the current game.
   */
  questions: PlayerPicksQuestion[] = [];

  /**
   * The current index of the player selecting a song pointing to an online player.
   */
  pickerIndex: number = 0;

  /**
   * The player currently selecting a song.
   */
  picker: Player | null = null;

  protected getNextQuestion(): Question {
    if (this.pickerIndex >= this.room.activePlayers.length) {
      this.pickerIndex = 0;
    }
    this.picker = this.room.activePlayers[this.pickerIndex++];

    const q = new PlayerPicksQuestion(
      this.currentQuestionIndex + 1,
      this.room.config,
      this.picker.conn.id,
    );

    this.room.server.logger.info(`Created PlayerPicksQuestion ${q.num}`);
    return q;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    const ret = super.onMessage(player, msg);

    if (msg.type === "player_pick_song") {
      if (this.gamePhase !== GamePhase.PICKING) {
        player.sendConfirmationOrError(msg, "Can only pick songs during picking phase.");
        return true;
      } else if (this.picker !== player) {
        player.sendConfirmationOrError(msg, "It is not your turn to pick a song.");
        return true;
      }

      // song was selected, continue to picked phase
      this.currentQuestion!.song = msg.song;
      this.currentQuestion!.startPos = msg.startPos;
      this.roundTick = ROUND_PICKED_SONG_TICK - 1;
      return true;
    }

    return ret;
  }

  onGamePhaseChanged() {
    if (this.gamePhase === GamePhase.QUESTION) {
      (this.currentQuestion! as PlayerPicksQuestion).isPickingPhase = false;
    }

    super.onGamePhaseChanged();
  }

  selectAnswer(player: Player, msg: SelectAnswerMessage) {
    const ret = super.selectAnswer(player, msg);
    if (player === this.picker) {
      player.sendConfirmationOrError(msg, "The picker is not allowed to guess.");
      return false;
    }

    if (ret)
      player.answerData!.answer = msg.answer!;

    return ret;
  }

  calculatePoints() {
    for (const player of this.room.activePlayers) {
      // if the player typed the song name perfectly (ignoring case)
      if (player.answerData && normalizeSongName(player.answerData.answer ?? "", false)
        === normalizeSongName(this.currentQuestion!.song!.name, false)) {
        // this gives the max points, so there is a bonus added of half the max points
        player.answerData.roundPoints = ROUND_POINTS_PER_QUESTION;
      } else if (player.answerData) {
        // check for partial correctness (ignoring parens)
        const playerAnswer = normalizeSongName(player.answerData.answer ?? "", true);
        const correctAnswer = normalizeSongName(this.currentQuestion!.song!.name, true);
        const levenshteinDist = distance(playerAnswer, correctAnswer);
        const similarity = 1 - (levenshteinDist / correctAnswer.length);

        // answer must be at least 40% correct to be counted
        if (similarity >= 0.4) {
          // scale 0-500 points linear with 75% - 100% similarity; will be at max half the points
          player.answerData.roundPoints = ((similarity - 0.4) / 0.6) * (ROUND_POINTS_PER_QUESTION / 2);
        }
      }

      if (player.answerData?.roundPoints !== undefined) {
        // other half of points depends on time the player needed to answer
        player.answerData!.roundPoints += this.getTimePoints(player);

        player.answerData!.roundPoints = Math.round(player.answerData!.roundPoints);
        player.points += player.answerData!.roundPoints;
      }
    }
  }
}
