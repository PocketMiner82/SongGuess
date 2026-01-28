import type {ClientMessage} from "../../types/MessageTypes";
import type {IEventListener} from "../listener/IEventListener";
import type * as Party from "partykit/server";
import type {ValidRoom} from "../ValidRoom";
import {BaseConfig} from "../../BaseConfig";
import _ from "lodash";
import {ROUND_PADDING_TICKS} from "../../ConfigConstants";


export default class ServerConfig extends BaseConfig implements IEventListener{
  constructor(private readonly room: ValidRoom) {
    super();
    room.listener.registerEvents(this);
  }

  onMessage(conn: Party.Connection, msg: ClientMessage): boolean {
    if (msg.type === "room_config") {
      if (!this.room.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
        return true;
      }

      let oldSongs = this.room.lobby.songs.slice();

      this.applyMessage(msg);
      this.room.lobby.filterSongs();

      this.room.getPartyRoom().broadcast(this.getConfigMessage());

      if (!_.isEqual(oldSongs, this.room.lobby.songs)) {
        this.room.getPartyRoom().broadcast(this.room.lobby.getPlaylistsUpdateMessage(true));
      }
      return true;
    }
    return false;
  }

  /**
   * The tick count when the answer gets revealed.
   */
  getRoundShowAnswerTick() {
    return this.timePerQuestion + ROUND_PADDING_TICKS;
  }

  /**
   * The tick count when the music fades out.
   */
  getRoundPauseMusicTick() {
    return this.timePerQuestion + ROUND_PADDING_TICKS * 2 - 1;
  }

  /**
   * The tick count when a new round shall be started.
   */
  getRoundStartNextTick() {
    return this.timePerQuestion + ROUND_PADDING_TICKS * 2;
  }
}