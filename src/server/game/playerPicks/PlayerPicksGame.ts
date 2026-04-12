import Game from "../Game";
import type {ClientMessage, SelectAnswerMessage} from "../../../types/MessageTypes";
import {ROUND_PICKED_SONG_TICK, ROUND_POINTS_PER_QUESTION} from "../../../ConfigConstants";
import type Question from "../Question";
import Player from "../../Player";
import PlayerPicksQuestion from "./PlayerPicksQuestion";
import GamePhase from "../GamePhase";


export class PlayerPicksGame extends Game {
  /**
   * The list of questions for the current game.
   */
  questions: PlayerPicksQuestion[] = [];

  /**
   * The player currently selecting a song.
   */
  picker?: Player;


  protected getNextQuestion(): Question {
    let q = new PlayerPicksQuestion(
        this.currentQuestion + 1,
        this.room.config
    );

    this.room.server.logger.info(`Created PlayerPicksQuestion ${q.num}`);
    return q;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    let ret = super.onMessage(player, msg);

    if (msg.type === "player_pick_song") {
      if (this.gamePhase !== GamePhase.PICKING) {
        player.sendConfirmationOrError(msg, "Can only pick songs during picking phase.");
        return true;
      } else if (this.picker !== player) {
        player.sendConfirmationOrError(msg, "You are not allowed to pick a song.");
        return true;
      }

      // song was selected, continue to picked phase
      this.questions[this.currentQuestion].song = msg.song;
      this.roundTicks = ROUND_PICKED_SONG_TICK - 1;
      return true;
    }

    return ret;
  }

  selectAnswer(player: Player, msg: SelectAnswerMessage) {
    super.selectAnswer(player, msg);
    //player.answerData!.answer = msg.answer!;
  }

  calculatePoints() {
    // for (let player of this.room.activePlayers) {
    //   if (player.answerData?.answerIndex === this.questions[this.currentQuestion].getCorrectAnswer()) {
    //     // half the points for correct answer
    //     player.points += ROUND_POINTS_PER_QUESTION / 2;
    //
    //     // remaining points depend on speed of answer
    //     let factor = Math.max(0, (this.room.config.timePerQuestion * 1000 - (player.answerData.answerTimestamp - this.roundStartTime)))
    //         / (this.room.config.timePerQuestion * 1000);
    //     player.points += (ROUND_POINTS_PER_QUESTION / 2) * factor;
    //
    //     player.points = Math.round(player.points);
    //   }
    // }
  }
}