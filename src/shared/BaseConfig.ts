import type { RoomConfigMessage } from "../types/MessageTypes";
import { RoomConfigMessageSchema } from "../schemas/SharedSchemas";
import { QUESTION_PADDING_TICKS, QUESTION_ROUND_START_TICK } from "./ConfigConstants";


export class BaseConfig implements RoomConfigMessage {
  public type: RoomConfigMessage["type"] = "room_config";

  public gameMode: RoomConfigMessage["gameMode"] = "multiple_choice";

  public advancedSongFiltering: boolean = true;

  public endWhenAnswered: boolean = false;

  public roundsCount: number = 10;

  public timePerQuestion: number = 25;

  public distractionsPreferSameArtist: boolean = true;

  public audioStartPosition: number | null = null;

  public playerPickTimeout: number = 180;

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

  /**
   * The tick count when a question song was picked.
   */
  public getQuestionPickedSongTick(): number {
    return QUESTION_ROUND_START_TICK + this.playerPickTimeout;
  }

  /**
   * The tick count when in answering phase.
   */
  public getQuestionAnsweringTick(): number {
    return this.getQuestionPickedSongTick() + QUESTION_PADDING_TICKS;
  }

  /**
   * The tick count when the answer gets revealed.
   */
  public getQuestionShowAnswerTick(): number {
    return this.getQuestionPickedSongTick() + this.timePerQuestion + QUESTION_PADDING_TICKS;
  }

  /**
   * The tick count when the music fades out.
   */
  public getQuestionPauseMusicTick(): number {
    return this.getQuestionPickedSongTick() + this.timePerQuestion + QUESTION_PADDING_TICKS * 2 - 1;
  }

  /**
   * The tick count when a new round shall be started.
   */
  public getQuestionStartNextTick(): number {
    return this.getQuestionPickedSongTick() + this.timePerQuestion + QUESTION_PADDING_TICKS * 2;
  }
}
