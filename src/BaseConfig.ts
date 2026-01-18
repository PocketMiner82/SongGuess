import type {RoomConfigMessage} from "./types/MessageTypes";

export class BaseConfig implements RoomConfigMessage {
  public type: RoomConfigMessage["type"] = "room_config";

  public advancedSongFiltering: boolean = true;

  public endWhenAnswered: boolean = true;

  constructor(msg?: RoomConfigMessage) {
    if (msg) {
      this.advancedSongFiltering = msg.advancedSongFiltering === true;
      this.endWhenAnswered = msg.endWhenAnswered === true;
    }
  }

  /**
   * Constructs a configuration update message.
   *
   * @returns a JSON string of the constructed {@link RoomConfigMessage}
   */
  public getConfigMessage(): string {
    const baseKeys: (keyof BaseConfig)[] = ['type', 'advancedSongFiltering', 'endWhenAnswered'];
    return JSON.stringify(this, baseKeys);
  }
}