import type * as Party from "partykit/server";
import type {ClientMessage} from "../../types/MessageTypes";
import type {IEventListener} from "./IEventListener";
import type {ValidRoom} from "../ValidRoom";

export default class Listener {
  /**
   * Contains all listeners that want to receive client messages.
   * @see registerEvents
   * @private
   */
  private messageListeners: IEventListener[] = [];


  constructor(readonly room: ValidRoom) {}


  /**
   * Handles incoming messages
   * @param conn the connection that sent the message
   * @param msg the sent {@link ClientMessage}
   */
  handleMessage(conn: Party.Connection, msg: ClientMessage) {
    // handle each message type
    switch(msg.type) {
      case "ping":
        // always directly answer pings
        this.room.server.safeSend(conn, {
          type: "pong",
          seq: msg.seq
        });
        return;
      case "pong":
        // currently ignored
        return;
      case "confirmation":
        if (msg.error) {
          this.room.server.logger.warn(`Client reported an error for ${msg.sourceMessage.type}:\n${msg.error}`);
        }
        break;
    }

    if (!this.messageListeners.some(l => l.onMessage?.(conn, msg))) {
      // in case a message was not handled by any listener
      this.room.sendConfirmationOrError(conn, msg as any, `Not implemented: ${(msg as ClientMessage).type}`);
    }
  }

  /**
   * Calls each onTick listener that is registered
   */
  handleTick() {
    this.messageListeners.forEach(listener => listener.onTick?.());
  }

  /**
   * Registers a new listener that recieves client messages.
   * @param listener the object that wants to listen for client messages.
   */
  public registerEvents(listener: IEventListener) {
    if (this.messageListeners.indexOf(listener) < 0) {
      this.messageListeners.push(listener);
    }
  }
}