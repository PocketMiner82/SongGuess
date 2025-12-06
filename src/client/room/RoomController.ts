import PartySocket from "partysocket";
import { lookup, type ResultMusicTrack } from "itunes-store-api";
import { useEffect, useState, useRef } from "react";
import type { HostUpdatePlaylistMessage } from "../../messages/RoomClientMessages";
import { ServerMessageSchema } from "../../messages/RoomMessages";
import type { CloseEvent, ErrorEvent } from "partysocket/ws";
import z from "zod";


declare const PARTYKIT_HOST: string;


/**
 * Manages the connection and state of a room.
 */
export class RoomController {
  /**
   * The PartySocket instance used for server communication.
   */
  private socket: PartySocket;

  /**
   * Listeners that are called whenever the state of the room changes.
   */
  private stateChangeEventListeners: ((instance: RoomController) => void)[] = [];

  public searchText: string = "";

  public results: ResultMusicTrack[] = [];

  /**
   * Creates a new RoomController instance and initializes the socket connection.
   * 
   * @param roomID The ID of the room to connect to.
   */
  constructor(roomID: string) {
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomID
    });

    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("open", this.onOpen.bind(this));
    this.socket.addEventListener("close", this.onClose.bind(this));
    this.socket.addEventListener("error", this.onError.bind(this));
  }

  /**
   * Cleans up resources and closes the socket connection.
   */
  public destroy() {
    this.socket.close();
  }

  /**
   * Registers a listener that will be called whenever the state of the room changes.
   * 
   * @param listener A callback function that receives the current instance of RoomController as an argument.
   * @returns A function to unregister the listener.
   */
  public registerOnStateChangeListener(listener: (instance: RoomController) => void) {
    this.stateChangeEventListeners.push(listener);
    return () => this.unregisterOnStateChangeListener(listener);
  }

  /**
   * Unregisters a previously registered state change listener.
   * @param listener The listener to unregister.
   */
  public unregisterOnStateChangeListener(listener: (instance: RoomController) => void) {
    this.stateChangeEventListeners = this.stateChangeEventListeners.filter(l => l !== listener);
  }
  
  /**
   * Calls all registered state change listeners.
   */
  private callOnStateChange() {
    for (const listener of this.stateChangeEventListeners) {
      listener(this);
    }
  }

  /**
   * Handles the "open" event of the socket connection.
   */
  private onOpen() {
    console.log(`Connected to ${this.socket.room}`);
  }

  /**
   * Handles the "close" event of the socket connection.
   * 
   * @param ev The CloseEvent containing details about the disconnection.
   */
  private onClose(ev: CloseEvent) {
    console.log(`Disconnected from ${this.socket.room} (${ev.code}): ${ev.reason}`);
  }

  /**
   * Handles the "error" event of the socket connection.
   * 
   * @param ev The ErrorEvent containing details about the error.
   */
  private onError(ev: ErrorEvent) {
    console.error(`Cannot connect to ${this.socket.room}:`, ev);
  }

  /**
   * Handles incoming messages from the server.
   * 
   * @param ev The MessageEvent containing the server message.
   */
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

  /**
   * Performs a search using the iTunes Store API and updates the search results.
   * 
   * @param text The search text to query.
   */
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
          // this attempts to fix a weird caching problem on Apple's side, where an old access-control-allow-origin header gets cached
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

    this.callOnStateChange();
  }
}


/**
 * Custom React hook that provides a {@link RoomController} instance for managing
 * the connection and state of a room.
 * 
 * @param roomID The ID of the room to connect to.
 * @returns An object containing a `getController` method to access the `RoomController` instance.
 */
export function useRoomController(roomID: string) {
  // hold the class instance so it persists across renders
  const controllerRef = useRef<RoomController | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // initialize the controller
    controllerRef.current = new RoomController(roomID);
    setIsReady(true);

    return () => {
      controllerRef.current?.destroy();
    };
  }, [roomID]);

  return {
    getController: (): RoomController => controllerRef.current!,
    isReady
  };
}


/**
 * Custom React hook to subscribe to state changes in a {@link RoomController}.
 * @param controller The RoomController instance to listen to.
 * @param cb A callback function that receives the RoomController instance when its state changes.
 */
export function useRoomControllerListener(controller: RoomController, cb: (c: RoomController) => void) {
  useEffect(() => {
    return controller.registerOnStateChangeListener(cb);
  }, [controller, cb]);
}