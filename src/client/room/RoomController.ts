import PartySocket from "partysocket";
import { lookup, type Entities, type Media, type Options, type ResultMusicTrack, type Results } from "itunes-store-api";
import { useEffect, useState, useRef } from "react";
import type { CloseEvent, ErrorEvent } from "partysocket/ws";
import z from "zod";
import type { Song, HostUpdatePlaylistMessage } from "../../schemas/RoomClientMessageSchemas";
import { ServerMessageSchema } from "../../schemas/RoomServerMessageSchemas";


declare const PARTYKIT_HOST: string;


/**
 * Manages the connection and state of a room.
 */
export class RoomController {
  private artistRegex = /^https?:\/\/music\.apple\.com\/[^/]*\/artist\/[^/]*\/(?<id>\d+)$/
  private albumRegex =  /^https?:\/\/music\.apple\.com\/[^/]*\/album\/[^/]*\/(?<id>\d+)$/

  /**
   * The PartySocket instance used for server communication.
   */
  private socket: PartySocket;

  /**
   * Listeners that are called whenever the state of the room changes.
   */
  private stateChangeEventListeners: ((instance: RoomController) => void)[] = [];

  /**
   * Whether we are the host of the room.
   */
  public isHost: boolean = false;

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

    // try to parse json
    try {
      var json = JSON.parse(ev.data);
    } catch (e) {
      console.error("Server sent invalid JSON:", e);
      return;
    }

    // check if received message is valid
    const result = ServerMessageSchema.safeParse(json);
    if (!result.success) {
      console.error("Server sent invalid data:\n%s", z.prettifyError(result.error));
      return;
    }

    let msg = result.data;

    // handle each message type
    switch (msg.type) {
      case "error":
        console.error(`Server reported an error:\n${msg.error_message}`);
        break;
      case "update":
        this.isHost = msg.isHost;
        this.callOnStateChange();
        break;
      default:
        console.error(`Invalid message type: ${msg.type}`);
    }
  }

  public getCurrentSong(): Song|null {
    // TODO: implement current song retrieval
    return null;
  }

  /**
   * Performs a search using the iTunes Store API and updates the search results.
   * 
   * @param text The search text to query.
   */
  public async performSearch(text: string) {
    let playlistName = "";
    let playlistCover = null;

    if (this.artistRegex.test(text)) {
      let artists = await this.lookupURL(text, {
        entity: "musicArtist",
        limit: 1
      });
      if (artists.length === 0) return;
      let artist = artists[0];
      
      playlistName = artist.artistName;
    } else if (this.albumRegex.test(text)) {
      let albums = await this.lookupURL(text, {
        entity: "album",
        limit: 1
      });
      if (albums.length === 0) return;
      let album = albums[0];
      
      playlistName = album.collectionName;
      playlistCover = album.artworkUrl100;
    } else {
      // not a valid apple music URL
      return;
    }

    let results: ResultMusicTrack[] = await this.lookupURL(text, {
      entity: "song",
      limit: 50
    });

    if (results.length === 0) return;

    // filter only music tracks and map to our internal format
    const songs = results.filter(r => r.wrapperType === "track").map(r => ({
      name: r.trackName,
      audioURL: r.previewUrl,
    }));

    const req: HostUpdatePlaylistMessage = {
      type: "host_update_playlists",
      playlists: [{
        playlistName: playlistName,
        playlistCover: playlistCover
      }],
      songs: songs
    };
    this.socket.send(JSON.stringify(req));

    this.callOnStateChange();
  }

  /**
   * Safely looks up a URL using the iTunes Store API. Also handles potential caching issues.
   * @param url The URL to look up.
   * @param options Optional lookup options.
   * @returns Promise resolving to an array of results.
   */
  private async lookupURL<M extends Media, E extends Entities[M]>(url: string, options: Partial<Options<M, E>> = {}): Promise<(E extends undefined ? Results[Entities[M]] : Results[E])[]> {
    let results: (E extends undefined ? Results[Entities[M]] : Results[E])[];

    try {
      try {
        results = (await lookup("url", url, options)).results;
      } catch {
        // this attempts to fix a weird caching problem on Apple's side, where an old access-control-allow-origin header gets cached
        try {
          let newOptions = {...options, magicnumber: Date.now()};
          // @ts-ignore
          results = (await lookup("url", url, newOptions)).results;
        } catch {
          results = [];
        }
      }
    } catch (e) {
      results = [];
    }

    return results;
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