import type {ClientMessage, RoomConfigMessage} from "../types/MessageTypes";
import type {IMessageListener} from "./IMessageListener";
import type * as Party from "partykit/server";
import type {ValidRoom} from "./ValidRoom";


export default class Config implements IMessageListener {
  /**
   * Whether to perform advanced song filtering.
   * @see {@link RoomConfigMessage.advancedSongFiltering}
   */
  public advancedSongFiltering: boolean = true;

  constructor(private readonly room: ValidRoom) {
    room.registerMessageListener(this);
  }

  onMessage(conn: Party.Connection, msg: ClientMessage): boolean {
    if (msg.type === "room_config") {
      if (!this.room.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
        return true;
      }

      // update filtered songs if config for that changed
      if (msg.advancedSongFiltering !== undefined) {
        this.advancedSongFiltering = msg.advancedSongFiltering;
        this.room.filterSongs();

        this.room.getPartyRoom().broadcast(this.getConfigMessage());
        this.room.getPartyRoom().broadcast(this.room.getPlaylistsUpdateMessage());
      }

      return true;
    }
    return false;
  }

  /**
   * Constructs a configuration update message.
   *
   * @returns a JSON string of the constructed {@link RoomConfigMessage}
   */
  public getConfigMessage(): string {
    return JSON.stringify({
      type: "room_config",
      advancedSongFiltering: this.advancedSongFiltering
    } satisfies RoomConfigMessage);
  }
}