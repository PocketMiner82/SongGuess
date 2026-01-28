import type {RoomConfigMessage} from "./types/MessageTypes";
import {RoomConfigMessageSchema} from "./schemas/SharedSchemas";

export class BaseConfig implements RoomConfigMessage {
  public type: RoomConfigMessage["type"] = "room_config";

  public advancedSongFiltering: boolean = true;

  public endWhenAnswered: boolean = false;

  public questionsCount: number = 10;

  public timePerQuestion: number = 15;

  public distractionsPreferSameArtist: boolean = true;


  constructor(msg?: RoomConfigMessage) {
    if (msg) this.applyMessage(msg);
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
  public getConfigMessage(): string {
    const baseKeys: (keyof BaseConfig)[] = Object.keys(RoomConfigMessageSchema.shape) as (keyof BaseConfig)[];
    return JSON.stringify(this, baseKeys);
  }
}