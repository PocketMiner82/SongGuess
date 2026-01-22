import type * as Party from "partykit/server";
import type {ClientMessage, PongMessage} from "../../types/MessageTypes";
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
    for (let l of this.messageListeners) {
      // exit if one of the subscribed listeners handled the event
      if (l.onMessage?.(conn, msg)) {
        return;
      }
    }

    // handle each message type
    switch(msg.type) {
      case "ping":
        // always directly answer pings
        conn.send(JSON.stringify({
          type: "pong",
          seq: msg.seq
        } satisfies PongMessage));
        break;
      case "pong":
        // currently ignored
        break;
      case "confirmation":
        if (msg.error) {
          this.room.server.log(`Client reported an error for ${msg.sourceMessage.type}:\n${msg.error}`, "warn");
        }
        break;
      case "change_username":
        this.room.changeUsername(conn, msg);
        break;
      case "add_playlists":
      case "remove_playlist":
        if (!this.room.performChecks(conn, msg, "host", "lobby", "not_contdown")) {
          return;
        }

        if (msg.type === "add_playlists") {
          let omitted = this.room.addPlaylists(msg);
          if (omitted > 0) {
            this.room.sendConfirmationOrError(conn, msg, `${omitted}/${msg.playlists.length} playlist(s) were omitted because they don't have songs or they don't have a unique name and album cover.`);

            // everything was omitted
            if (omitted === msg.playlists.length) {
              conn.send(this.room.getPlaylistsUpdateMessage());
              return;
            }
          }
        } else if (msg.type === "remove_playlist" && !this.room.removePlaylist(msg)) {
          this.room.sendConfirmationOrError(conn, msg, `Index out of bounds: ${msg.index}`);
          conn.send(this.room.getPlaylistsUpdateMessage());
          return;
        }
        // always re-filter songs after playlist update
        this.room.filterSongs();

        // playlist updates will force to include all songs again
        this.room.game.remainingSongs = [];

        // send the update to all players + confirmation to the host
        this.room.getPartyRoom().broadcast(this.room.getPlaylistsUpdateMessage());
        this.room.sendConfirmationOrError(conn, msg);
        break;
      default:
        // in case a message is defined but not yet implemented
        this.room.sendConfirmationOrError(conn, msg as any, `Not implemented: ${(msg as ClientMessage).type}`);
        break;
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