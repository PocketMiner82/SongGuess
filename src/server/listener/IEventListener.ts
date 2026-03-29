import type {ClientMessage} from "../../types/MessageTypes";
import type Player from "../Player";


export interface IEventListener {
  /**
   * Handles incoming client messages
   * @param player the player that sent the message
   * @param msg the sent message
   * @returns whether the message was handled by this listener.
   */
  onMessage?(player: Player, msg: ClientMessage): boolean;

  /**
   * Called every time the tick loop of {@link ValidRoom} is run.
   */
  onTick?(): void;
}