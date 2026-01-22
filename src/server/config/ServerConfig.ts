import type {ClientMessage} from "../../types/MessageTypes";
import type {IMessageListener} from "../listener/IMessageListener";
import type * as Party from "partykit/server";
import type {ValidRoom} from "../ValidRoom";
import {BaseConfig} from "../../BaseConfig";


export default class ServerConfig extends BaseConfig implements IMessageListener{
  constructor(private readonly room: ValidRoom) {
    super();
    room.listener.registerMessageListener(this);
  }

  onMessage(conn: Party.Connection, msg: ClientMessage): boolean {
    if (msg.type === "room_config") {
      if (!this.room.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
        return true;
      }

      super.applyMessage(msg);

      this.room.filterSongs();
      this.room.getPartyRoom().broadcast(super.getConfigMessage());
      this.room.getPartyRoom().broadcast(this.room.getPlaylistsUpdateMessage());
      return true;
    }
    return false;
  }
}