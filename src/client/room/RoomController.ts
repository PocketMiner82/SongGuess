import PartySocket from "partysocket";
import { lookup, type ResultMusicTrack } from "itunes-store-api";
import { useEffect, useState, useRef } from "react";
import type { HostUpdatePlaylistMessage } from "../../messages/RoomClientMessages";
import { ServerMessageSchema } from "../../messages/RoomMessages";
import type { CloseEvent, ErrorEvent } from "partysocket/ws";
import z from "zod";


declare const PARTYKIT_HOST: string;


class RoomController {
  private socket: PartySocket;
  private notifyReact: (searchText: string, results: ResultMusicTrack[] | undefined) => void;

  public searchText: string = "";
  public results: ResultMusicTrack[] | undefined = undefined;

  constructor(
    roomID: string, 
    onStateChange: (text: string, results: ResultMusicTrack[] | undefined) => void
  ) {
    this.notifyReact = onStateChange;

    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomID
    });

    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("open", this.onOpen.bind(this));
    this.socket.addEventListener("close", this.onClose.bind(this));
    this.socket.addEventListener("error", this.onError.bind(this));
  }

  // Cleanup method to call when React component unmounts
  public destroy() {
    this.socket.close();
  }

  private onOpen() {
    console.log(`Connected to ${this.socket.room}`);
  }

  private onClose(ev: CloseEvent) {
    console.log(`Disconnected from ${this.socket.room} (${ev.code}): ${ev.reason}`);
  }

  private onError(ev: ErrorEvent) {
    console.error(`Cannot connect to ${this.socket.room}:`, ev);
  }

  // Central Logic: handle incoming messages
  private onMessage(ev: MessageEvent) {
    console.debug("Server sent:", ev.data);

    try {
      const json = JSON.parse(ev.data);
      const result = ServerMessageSchema.safeParse(json);
      if (!result.success) {
          console.error("Server sent invalid data:\n%s", z.prettifyError(result.error));
          return;
        }

      const msg = result.data;

      if (msg.type === "server_update_playlists" && msg.playlists[0]) {
        const newName = msg.playlists[0].playlistName;

        if (newName !== this.searchText) {
          this.performSearch(newName);
        }
      }
    } catch (e) {
      console.error("Server sent invalid JSON:", e);
    }
  }

  // Central Logic: Perform Search and Notify React
  public async performSearch(text: string) {
    this.searchText = text;

    const req: HostUpdatePlaylistMessage = {
      type: "host_update_playlists",
      playlists: [{ playlistName: text, playlistCover: null }],
      songs: []
    };
    this.socket.send(JSON.stringify(req));

    try {
      try {
        this.results = (await lookup("url", text, {
          entity: "song",
          limit: 200
        })).results;
      } catch {
        try {
          // this attempts to fix a weird chaching problem on apple's side, where an old access-control-allow-origin header gets cached
          // @ts-ignore
          this.results = (await lookup("url", text, {
            entity: "song",
            limit: 200,
            magicnumber: Date.now()
          })).results;
        } catch {
          this.results = [];
        }
      }
    } catch (e) {
      this.results = [];
    }

    this.notifyReact(this.searchText, this.results);
  }
}


export function useRoomController(roomID: string)  {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ResultMusicTrack[]>();

  // hold the class instance so it persists across renders
  const controllerRef = useRef<RoomController | null>(null);

  useEffect(() => {
    // initialize the controller
    controllerRef.current = new RoomController(roomID, (newText, newResults) => {
      setSearchText(newText);
      setResults(newResults);
    });

    return () => {
      controllerRef.current?.destroy();
    };
  }, [roomID]);

  return {
    searchText,
    results,
    search: (text: string) => controllerRef.current?.performSearch(text),
    setSearchText: setSearchText
  };
}