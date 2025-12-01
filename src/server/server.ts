import type * as Party from "partykit/server";
import { fetchGetRoom, fetchPushRoom, type RoomInfoResponse } from "./ServerRoomRequests";

export default class Server implements Party.Server {
  /**
   * True, if this room was created by a request to /createRoom
   */
  isValidRoom: boolean = false;

  /**
   * This is the websocket connection of the host.
   * If the host leaves, the room will close.
   * A host can:
   *  - Start the game
   *  - Select a playlist
   *  - Kick players
   */
  hostConnection: Party.Connection|null = null;


  constructor(readonly room: Party.Room) {}

  //
  // ROOM WS
  //

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // first player connected, this must be the host
    if (this.getOnlineCount() === 1) {
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
    if (this.getOnlineCount() === 0) {
      this.hostConnection = null;
      this.isValidRoom = false;
    }
  }

  private getOnlineCount(): number {
    return Array.from(this.room.getConnections()).length;
  }

  //
  // ROOM HTTP
  //

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "GET") {
      let json: RoomInfoResponse = {
        onlineCount: this.getOnlineCount(),
        isValidRoom: this.isValidRoom
      };

      return Response.json(json);
    } else if (req.method === "PUSH") {
      let url = new URL(req.url);
      if (url.searchParams.has("token") && url.searchParams.get("token") === this.room.env.VALIDATE_ROOM_TOKEN) {
        this.isValidRoom = true;

        // if no one joins within 5 seconds, invalidate the room number again
        setTimeout(() => {
          if (this.getOnlineCount() === 0) {
            this.isValidRoom = false;
          }
        }, 5000);

        return new Response("ok", { status: 200 });
      }

      return new Response("Token invalid/missing.", { status: 401 });
    }

    return new Response("Bad request", { status: 400 });
  }

  //
  // STATIC ROOM WS CONNECT
  //

  static async onBeforeConnect(req: Party.Request, lobby: Party.Lobby, ctx: Party.ExecutionContext) {
    let roomInfo = await fetchGetRoom(req.url);

    // room does not exist
    if (!roomInfo || !roomInfo.isValidRoom) {
      return new Response("Room does not exist", {status: 401});
    }

    return req;
  }

  //
  // STATIC GLOBAL FETCH
  //

  private static async generateRoomID(origin: string): Promise<string | null> {
    let text: string = "";
    let possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i: number = 0; i < 6; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      let roomInfo = await fetchGetRoom(`${origin}/parties/main/${text}`);

      // room already exists
      if (roomInfo && roomInfo.isValidRoom) {
        continue;
      }

      return text;
    }
    
    return null;
  }

  private static async createNewRoom(origin: string, token: string): Promise<Response> {
    let roomID = await Server.generateRoomID(origin);

    if (roomID) {
      await fetchPushRoom(`${origin}/parties/main/${roomID}`, token);
    }
    
    return roomID == null ? new Response("Can't find a free room id.", {status: 409}) : new Response(roomID, {status: 201});
  }

  static async onFetch(req: Party.Request, lobby: Party.FetchLobby, ctx: Party.ExecutionContext) {
    let url: URL = new URL(req.url);

    // if room url is requested without html extension, add it
    if (url.pathname === "/room") {
      return lobby.assets.fetch("/room.html" + url.search);
    } else if (url.pathname === "/createRoom") {
      return await Server.createNewRoom(new URL(req.url).origin, lobby.env.VALIDATE_ROOM_TOKEN as string);
    }

    // redirect to main page, if on another one
    return Response.redirect(url.origin);
  }
}

Server satisfies Party.Worker;
