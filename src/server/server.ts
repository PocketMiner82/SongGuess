import type * as Party from "partykit/server";

export default class Server implements Party.Server {
  static rooms: Set<string> = new Set<string>();
  hostConnection: Party.Connection|null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // first player connected, this must be the host
    if (this.getOnlineCount() == 1) {
      this.hostConnection = conn;
      Server.rooms.add(this.room.id);
    }

    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`
    );

    // let's send a message to the connection
    conn.send("hello from server");
    conn.state
  }

  onMessage(message: string, sender: Party.Connection) {
    // let's log the message
    console.log(`connection ${sender.id} sent message: ${message}`);
    // as well as broadcast it to all the other connections in the room...
    this.room.broadcast(
      `${sender.id}: ${message}`,
      // ...except for the connection it came from
      [sender.id]
    );
  }

  onClose(connection: Party.Connection) {
    console.log(this.getOnlineCount());

    // host left, close room
    if (this.hostConnection === connection) {
      for (const conn of this.room.getConnections()) {
        conn.close(4000, "Host left room");
      }
    }

    // no more players left, cleanup the room
    if (this.getOnlineCount() == 0) {
      this.hostConnection = null;
      Server.rooms.delete(this.room.id);
    }
  }

  private getOnlineCount(): number {
    return Array.from(this.room.getConnections()).length;
  }

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, ctx: Party.ExecutionContext) {
    let url: URL = new URL(req.url);

    // if room url is requested without html extension, add it
    if (url.pathname === '/room') {
      return lobby.assets.fetch("/room.html" + url.search);
    }

    // redirect to main page, if on another one
    return Response.redirect(url.origin);
  }
}

Server satisfies Party.Worker;
