import type * as Party from "partykit/server";

export default class Server implements Party.Server {
  static rooms: Map<string, boolean> = new Map();
  hostConnection: Party.Connection|null = null;

  constructor(readonly room: Party.Room) {}

  static async onBeforeConnect(
    req: Party.Request,
    lobby: Party.Lobby,
    ctx: Party.ExecutionContext
  ) {
    // room does not exist
    if (!Server.rooms.has(lobby.id)) {
      return new Response("Room does not exist", {status: 401});
    }

    return req;
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // check if room is set to being used (so that our timeout handler doesnt delete it)
    const isUsed = Server.rooms.get(this.room.id);
    if (!isUsed) {
      Server.rooms.set(this.room.id, true); 
    }

    // first player connected, this must be the host
    if (this.getOnlineCount() == 1) {
      this.hostConnection = conn;
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

    console.log(Server.rooms);
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

  private static async generateRoomID(): Promise<string | null> {
    let text: string = "";
    let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i: number = 0; i < 6; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      if (Server.rooms.has(text)) {
        continue;
      }

      return text;
    }
    
    return null;
  }

  private static async createNewRoom(ctx: Party.ExecutionContext): Promise<Response> {
    let roomID = await Server.generateRoomID();

    if (roomID) {
      const roomTimeoutPromise = new Promise<void>((resolve) => {
        // set the timeout inside the Promise
        const timeout = setTimeout(() => {
          // only delete room if not used
          if (Server.rooms.get(roomID) === false) {
            Server.rooms.delete(roomID);
          }

          // always resolve the promise
          resolve();
        }, 5000);

        Server.rooms.set(roomID, false);
      });

      ctx.waitUntil(roomTimeoutPromise);
    }
    
    return roomID == null ? new Response("Can't find free room id.", {status: 409}) : new Response(roomID, {status: 201});
  }

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, ctx: Party.ExecutionContext) {
    let url: URL = new URL(req.url);

    // if room url is requested without html extension, add it
    if (url.pathname === "/room") {
      return lobby.assets.fetch("/room.html" + url.search);
    } else if (url.pathname === "/createRoom") {
      return await Server.createNewRoom(ctx);
    }

    // redirect to main page, if on another one
    return Response.redirect(url.origin);
  }
}

Server satisfies Party.Worker;
