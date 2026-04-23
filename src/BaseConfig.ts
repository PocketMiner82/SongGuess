import type { RoomConfigMessage } from "./types/MessageTypes";
import { RoomConfigMessageSchema } from "./schemas/SharedSchemas";


export class BaseConfig implements RoomConfigMessage {
  public type: RoomConfigMessage["type"] = "room_config";

  public gameMode: RoomConfigMessage["gameMode"] = "multiple_choice";

  public advancedSongFiltering: boolean = true;

  public endWhenAnswered: boolean = false;

  public questionsCount: number = 10;

  public timePerQuestion: number = 25;

  public distractionsPreferSameArtist: boolean = true;

  public audioStartPosition: number = 3;

  constructor(msg?: RoomConfigMessage) {
    if (msg)
      this.applyMessage(msg);
  }

  /**
   * Applys a {@link RoomConfigMessage} to this config instance.
   * @param msg the message to apply.
   */
  public applyMessage(msg: RoomConfigMessage) {
    Object.assign(this, msg);
  }

  /**
   * Constructs a configuration update message.
   *
   * @returns a JSON string of the constructed {@link RoomConfigMessage}
   */
  public toConfigMessage(): RoomConfigMessage {
    const baseKeys = Object.keys(RoomConfigMessageSchema.shape);

    const entries = baseKeys.map(key => [key, this[key as keyof this]]);
    return Object.fromEntries(entries);
  }
}
