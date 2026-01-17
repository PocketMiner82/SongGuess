import type {ClientMessage} from "../types/MessageTypes";
import type {IMessageListener} from "./IMessageListener";
import type * as Party from "partykit/server";
import type {ValidRoom} from "./ValidRoom";
import {BaseConfig} from "../BaseConfig";


export default class ServerConfig extends BaseConfig implements IMessageListener{
  constructor(private readonly room: ValidRoom) {
    super();
    room.registerMessageListener(this);
  }

  onMessage(conn: Party.Connection, msg: ClientMessage): boolean {
    if (msg.type === "room_config") {
      if (!this.room.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
        return true;
      }

      if (msg.advancedSongFiltering !== undefined) {
        this.advancedSongFiltering = msg.advancedSongFiltering;
        this.room.filterSongs();

        this.room.getPartyRoom().broadcast(super.getConfigMessage());
        this.room.getPartyRoom().broadcast(this.room.getPlaylistsUpdateMessage());
      }

      if (msg.endWhenAnswered !== undefined) {
        this.endWhenAnswered = msg.endWhenAnswered;
        this.room.getPartyRoom().broadcast(super.getConfigMessage());
      }

      return true;
    }
    return false;
  }
}