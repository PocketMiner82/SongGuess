import type {ClientMessage} from "../../types/MessageTypes";
import type {IEventListener} from "../listener/IEventListener";
import type {ValidRoom} from "../ValidRoom";
import {BaseConfig} from "../../BaseConfig";
import _ from "lodash";
import {ROUND_PADDING_TICKS, ROUND_PICKED_SONG_TICK} from "../../ConfigConstants";
import type Player from "../Player";
import {MultipleChoiceGame} from "../game/multipleChoice/MultipleChoiceGame";
import {PlayerPicksGame} from "../game/playerPicks/PlayerPicksGame";


export default class ServerConfig extends BaseConfig implements IEventListener{
  constructor(private readonly room: ValidRoom) {
    super();
    room.listener.registerEvents(this);
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    if (msg.type === "room_config") {
      if (!this.room.performChecks(player, msg, "host", "lobby", "not_contdown")) {
        return true;
      }

      let oldSongs = this.room.lobby.songs.slice();

      if (this.gameMode !== msg.gameMode) {
        this.room.game.destroy();

        switch (msg.gameMode) {
          case "multiple_choice":
            this.room.game = new MultipleChoiceGame(this.room);
            break;
          case "player_picks":
            this.room.game = new PlayerPicksGame(this.room);
            break;
        }
      }

      this.applyMessage(msg);
      this.room.lobby.filterSongs();

      this.room.server.safeBroadcast(this.toConfigMessage());

      if (!_.isEqual(oldSongs, this.room.lobby.songs)) {
        this.room.server.safeBroadcast(this.room.lobby.getPlaylistsUpdateMessage(true));
      }
      return true;
    }
    return false;
  }

  /**
   * The tick count when the answer gets revealed.
   */
  getRoundShowAnswerTick() {
    return ROUND_PICKED_SONG_TICK + this.timePerQuestion + ROUND_PADDING_TICKS;
  }

  /**
   * The tick count when the music fades out.
   */
  getRoundPauseMusicTick() {
    return ROUND_PICKED_SONG_TICK + this.timePerQuestion + ROUND_PADDING_TICKS * 2 - 1;
  }

  /**
   * The tick count when a new round shall be started.
   */
  getRoundStartNextTick() {
    return ROUND_PICKED_SONG_TICK + this.timePerQuestion + ROUND_PADDING_TICKS * 2;
  }
}