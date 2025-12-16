import PartySocket from "partysocket";
import { lookup, type Entities, type Media, type Options, type ResultMusicTrack, type Results } from "itunes-store-api";
import { useEffect, useState, useRef, useCallback } from "react";
import type { CloseEvent, ErrorEvent } from "partysocket/ws";
import z from "zod";
import type { ChangeUsernameMessage, HostUpdatePlaylistMessage, StartGameMessage } from "../../schemas/RoomClientMessageSchemas";
import { albumRegex, artistRegex, UnknownPlaylist, type Playlist } from "../../schemas/RoomSharedMessageSchemas";
import { type ServerMessage, ServerMessageSchema } from "../../schemas/RoomMessageSchemas";
import type { PlayerState } from "../../schemas/RoomServerMessageSchemas";


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
  private stateChangeEventListeners: ((msg: ServerMessage) => void)[] = [];

  /**
   * Creates a new RoomController instance and initializes the socket connection.
   * 
   * @param roomID The ID of the room to connect to.
   */
  constructor(roomID: string) {
    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomID,
      maxRetries: 0
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
   * (Re)connect to the PartyKit server.
   */
  public reconnect() {
    this.socket.reconnect();
  }

  /**
   * Registers a listener that will be called whenever the state of the room changes.
   * 
   * @param listener A callback function that receives the sent {@link ServerMessage} as an argument.
   * @returns A function to unregister the listener.
   */
  public registerOnStateChangeListener(listener: (msg: ServerMessage) => void) {
    this.stateChangeEventListeners.push(listener);
    return () => this.unregisterOnStateChangeListener(listener);
  }

  /**
   * Unregisters a previously registered state change listener.
   * @param listener The listener to unregister.
   */
  public unregisterOnStateChangeListener(listener: (msg: ServerMessage) => void) {
    this.stateChangeEventListeners = this.stateChangeEventListeners.filter(l => l !== listener);
  }
  
  /**
   * Calls all registered state change listeners.
   * 
   * @param msg the received {@link ServerMessage} that caused the state change
   */
  private callOnStateChange(msg: ServerMessage) {
    for (const listener of this.stateChangeEventListeners) {
      listener(msg);
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
    window.location.href = "/";
  }

  /**
   * Handles the "error" event of the socket connection.
   * 
   * @param ev The ErrorEvent containing details about the error.
   */
  private onError(ev: ErrorEvent) {
    console.error(`Cannot connect to ${this.socket.room}:`, ev);
    window.location.href = "/";
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

    let msg: ServerMessage = result.data;

    if (msg.type === "confirmation" && msg.error) {
      console.error(`Server reported an error for ${msg.source}:\n${msg.error}`);
    }

    // call listeners
    this.callOnStateChange(msg);
  }

  public updateUsername(newName: string) {
    let msg: ChangeUsernameMessage = {
      type: "change_username",
      username: newName
    };
    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Requests the server to start the game.
   */
  public startGame() {
    let msg: StartGameMessage = {
      type: "start_game"
    };
    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Performs a search for songs based on the provided Apple Music URL.
   * If the URL is valid and songs are found, it sends an update to the server.
   * 
   * @param url The Apple Music URL to search for.
   * @returns A Promise resolving to true if the search was successful and songs were found, false otherwise.
   */
  public async performSearch(url: string): Promise<boolean> {
    if (!artistRegex.test(url) && !albumRegex.test(url)) {
      return false;
    }

    let results: ResultMusicTrack[] = await this.lookupURL(url, {
      entity: "song",
      limit: 50
    });

    if (results.length === 0) return false;

    // filter only music tracks and map to our internal format
    const songs = results.filter(r => r.wrapperType === "track").map(r => ({
      name: r.trackName,
      audioURL: r.previewUrl,
    }));

    const playlist: Playlist = await this.getPlaylistInfo(url);
    playlist.songs = songs;

    const req: HostUpdatePlaylistMessage = {
      type: "host_update_playlists",
      playlists: [playlist]
    };
    this.socket.send(JSON.stringify(req));
    
    return true;
  }

  private async getPlaylistInfo(url: string): Promise<Playlist> {
    try {
      let page = await fetch("/parties/main/playlistInfo?url=" + encodeURIComponent(url));
      let data: Playlist = await page.json();
      return data;
    } catch {
      return UnknownPlaylist;
    }
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
export function useRoomControllerListener(controller: RoomController, cb: (msg: ServerMessage) => void) {
  useEffect(() => {
    return controller.registerOnStateChangeListener(cb);
  }, [controller, cb]);
}

/**
 * Custom React hook to manage and provide the list of players and the username
 * of the current user in a room.
 * 
 * @param controller The RoomController instance to listen to.
 * @returns An object containing the list of players and the current user's username.
 */
export function usePlayers(controller: RoomController) {
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [username, setUsername] = useState("");

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setPlayers(msg.players);
      setUsername(msg.username);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  return { players, username };
}

export function usePlaylists(controller: RoomController) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg.type === "server_update_playlists") {
      setPlaylists(msg.playlists);
    }
  }, []));

  return playlists;
}

export function useIsHost(controller: RoomController) {
  const [isHost, setIsHost] = useState(false);
  
  useRoomControllerListener(controller, useCallback((msg) => {
    if (msg.type === "update") setIsHost(msg.isHost);
  }, []));

  return isHost;
}