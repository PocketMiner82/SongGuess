import type {ClientMessage} from "../../types/MessageTypes";
import type * as Party from "partykit/server";


export interface IEventListener {
  /**
   * Handles incoming client messages
   * @param conn the connection that sent the message
   * @param msg the sent message
   * @returns whether the message was handled by this listener.
   */
  onMessage?(conn: Party.Connection, msg: ClientMessage): boolean;

  /**
   * Called every time the tick loop of {@link ValidRoom} is run.
   */
  onTick?(): void;
}