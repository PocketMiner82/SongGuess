import type * as Party from "partykit/server";
import type {ClientMessage, PongMessage} from "../../types/MessageTypes";
import type {IMessageListener} from "./IMessageListener";
import type {ValidRoom} from "../ValidRoom";
import {DistractionError} from "../Question";

export default class Listener {
  /**
   * Contains all listeners that want to receive client messages.
   * @see registerMessageListener
   * @private
   */
  private messageListeners: IMessageListener[] = [];


  constructor(readonly room: ValidRoom) {}

  handleMessage(conn: Party.Connection, msg: ClientMessage) {
    for (let l of this.messageListeners) {
      // exit if one of the subscribed listeners handled the event
      if (l.onMessage(conn, msg)) {
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
            this.room.sendConfirmationOrError(conn, msg, `${omitted}/${msg.playlists.length} playlist(s) were ommited because they don't have songs or they don't have a unique name and album cover.`);
          } else {
            this.room.sendConfirmationOrError(conn, msg);
          }
        } else if (msg.type === "remove_playlist" && !this.room.removePlaylist(msg)) {
          this.room.sendConfirmationOrError(conn, msg, `Index out of bounds: ${msg.index}`);
          conn.send(this.room.getPlaylistsUpdateMessage());
          return;
        } else {
          this.room.sendConfirmationOrError(conn, msg);
        }

        // always re-filter songs after playlist update
        this.room.filterSongs();

        // send the update to all players + confirmation to the host
        this.room.getPartyRoom().broadcast(this.room.getPlaylistsUpdateMessage());
        break;
      case "start_game":
        if (!this.room.performChecks(conn, msg, "host", "not_ingame", "not_contdown")) {
          return;
        }

        if (!this.room.performChecks(conn, msg, "min_song_count")) {
          return;
        }

        // make sure setting distractions worked
        try {
          this.room.regenerateRandomQuestions();
        } catch (e) {
          if (this.room.hostConnection && e instanceof DistractionError) {
            this.room.sendConfirmationOrError(this.room.hostConnection, msg, e.message);
          } else if (this.room.hostConnection) {
            this.room.sendConfirmationOrError(this.room.hostConnection, msg, "Unknown error while starting game.");
            this.room.server.log(e, "error");
          }
          return;
        }

        this.room.sendConfirmationOrError(conn, msg);
        this.room.startGame();
        break;
      case "select_answer":
        if (!this.room.performChecks(conn, msg, "answer")) {
          return;
        }

        this.room.selectAnswer(conn, msg);
        break;
      case "return_to":
        if (!this.room.performChecks(conn, msg, "host", "not_lobby")) {
          return;
        }

        switch (msg.where) {
          case "lobby":
            this.room.resetGame();
            // returning to lobby will force to include all songs again
            this.room.remainingSongs = [];
            break;
          case "results":
            this.room.endGame();
            break;
        }

        this.room.broadcastUpdateMessage();
        break;
      default:
        // in case a message is defined but not yet implemented
        this.room.sendConfirmationOrError(conn, msg as any, `Not implemented: ${(msg as ClientMessage).type}`);
        break;
    }
  }

  /**
   * Registers a new listener that recieves client messages.
   * @param listener the object that wants to listen for client messages.
   */
  public registerMessageListener(listener: IMessageListener) {
    if (this.messageListeners.indexOf(listener) < 0) {
      this.messageListeners.push(listener);
    }
  }
}