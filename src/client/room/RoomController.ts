import PartySocket from "partysocket";
import {type Entities, lookup, type Media, type Options, type ResultMusicTrack, type Results} from "itunes-store-api";
import {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import type {CloseEvent, ErrorEvent} from "partysocket/ws";
import z from "zod";
import type {
  ChangeUsernameMessage,
  AddPlaylistMessage,
  RemovePlaylistMessage,
  StartGameMessage,
  SelectAnswerMessage
} from "../../schemas/RoomClientMessageSchemas";
import {
  albumRegex,
  artistRegex,
  type Playlist,
  songRegex,
  UnknownPlaylist
} from "../../schemas/RoomSharedMessageSchemas";
import {type ServerMessage, ServerMessageSchema} from "../../schemas/RoomMessageSchemas";
import type {AnswerMessage, GameState, PlayerState, QuestionMessage} from "../../schemas/RoomServerMessageSchemas";


/**
 * The PartyKit host URL for WebSocket connections.
 */
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
  private stateChangeEventListeners: ((msg: ServerMessage|null) => void)[] = [];

  players: PlayerState[] = [];

  username: string = "Unknown";

  isHost: boolean = false;

  playlists: Playlist[] = [];

  state: GameState = "lobby";

  currentQuestion: QuestionMessage|null = null;

  currentAnswer: AnswerMessage|null = null;

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
  public registerOnStateChangeListener(listener: (msg: ServerMessage|null) => void) {
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
  private callOnStateChange(msg: ServerMessage|null) {
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

    // if port is set, this is probably a dev environment: don't redirect
    if (!window.location.port) window.location.href = "/";
  }

  /**
   * Handles the "error" event of the socket connection.
   * 
   * @param ev The ErrorEvent containing details about the error.
   */
  private onError(ev: ErrorEvent) {
    console.error(`Cannot connect to ${this.socket.room}:`, ev);
    // if port is set, this is probably a dev environment: don't redirect
    if (!window.location.port) window.location.href = "/";
  }

  /**
   * Handles incoming messages from the server.
   * 
   * @param ev The MessageEvent containing the server message.
   */
  private onMessage(ev: MessageEvent) {
    console.debug("Server sent:", ev.data);

    // try to parse JSON
    try {
      // noinspection ES6ConvertVarToLetConst
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

    switch (msg.type) {
      case "confirmation":
        if (msg.error) {
          console.error(`Server reported an error for ${msg.sourceMessage.type}:\n${msg.error}`);
        }
        break;
      case "update":
        this.username = msg.username;
        this.players = msg.players;
        this.isHost = msg.isHost;
        this.state = msg.state;
        break;
      case "update_playlists":
        this.playlists = msg.playlists;
        break;
      case "question":
        this.currentQuestion = msg;
        this.currentAnswer = null;
        break;
      case "answer":
        this.currentAnswer = msg;
        this.currentQuestion = null;
        break;
    }

    // call listeners
    this.callOnStateChange(msg);
  }

  /**
   * Updates the username of the current player.
   *
   * @param newName The new username to set.
   */
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
   * Sends the selected answer to the server.
   * @param answerIndex The index of the selected answer (0-3).
   */
  public selectAnswer(answerIndex: number) {
    let msg: SelectAnswerMessage = {
      type: "select_answer",
      answerIndex
    };
    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Requests the server to remove a playlist from the list.
   * @param index the index of the playlist to remove.
   */
  public removePlaylist(index: number) {
    let req: RemovePlaylistMessage = {
      type: "remove_playlist",
      index: index
    };

    this.socket.send(JSON.stringify(req));
  }

  /**
   * Attempts to add a playlist from the given Apple Music URL.
   * If the URL is valid and songs are found, it sends an update to the server.
   * 
   * @param url The Apple Music URL of the artist or album.
   * @returns A Promise resolving to true if the playlist was added, false otherwise.
   */
  public async tryAddPlaylist(url: string): Promise<boolean> {
    let targetLookupUrl: string = url;
    if (songRegex.test(targetLookupUrl)) {
      targetLookupUrl = targetLookupUrl.replace(songRegex, (match, song, id) => {
        return match.replace(id, `0?i=${id}`)
            .replace(song, "album");
      });
      console.log(targetLookupUrl);
    } else if (!artistRegex.test(targetLookupUrl) && !albumRegex.test(targetLookupUrl)) {
      return false;
    }

    const playlist: Playlist = await this.getPlaylistInfo(url);
    if (playlist.songs!.length === 0) {
      let results: ResultMusicTrack[] = await this.lookupURL(targetLookupUrl, {
        entity: "song",
        limit: 50
      });

      if (results.length === 0) return false;

      // filter only music tracks and map to our internal format
      playlist.songs = results.filter(r => r.wrapperType === "track").map(r => ({
        name: r.trackName,
        audioURL: r.previewUrl,
      }));
    }

    const req: AddPlaylistMessage = {
      type: "add_playlist",
      playlist: playlist
    };
    this.socket.send(JSON.stringify(req));

    return true;
  }

  /**
   * Fetches playlist information from the server.
   *
   * @param url The Apple Music URL of the playlist.
   * @returns A Promise resolving to the Playlist information.
   */
  private async getPlaylistInfo(url: string): Promise<Playlist> {
    try {
      let page = await fetch("/parties/main/playlistInfo?url=" + encodeURIComponent(url));
      return await page.json();
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
          let newOptions = { ...options, magicnumber: Date.now() };
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
 * React context for providing the RoomController instance to child components.
 */
export const RoomContext = createContext<RoomController | null>(null);

/**
 * Custom React hook to access the RoomController from the React context.
 * 
 * @returns The RoomController instance.
 * @throws Error if used outside a RoomProvider.
 */
export function useControllerContext() {
  const controller = useContext(RoomContext);
  if (!controller) throw new Error("useRoom must be used within RoomProvider");
  return controller;
}


/**
 * Custom React hook to subscribe to state changes in a {@link RoomController}.
 * @param controller The RoomController instance to listen to.
 * @param cb A callback function that receives the RoomController instance when its state changes.
 */
export function useRoomControllerListener(controller: RoomController, cb: (msg: ServerMessage|null) => void) {
  useEffect(() => {
    cb(null);
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

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type === "update") {
      setPlayers(controller.players);
      setUsername(controller.username);
    }
  }, [controller.players, controller.username]);

  useRoomControllerListener(controller, listener);

  return { players, username };
}

/**
 * Custom React hook to manage and provide the list of playlists in a room.
 * 
 * @param controller The RoomController instance to listen to.
 * @returns The current list of playlists.
 */
export function usePlaylists(controller: RoomController) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useRoomControllerListener(controller, useCallback((msg) => {
    if (!msg || msg.type === "update_playlists") {
      setPlaylists(controller.playlists);
    }
  }, [controller.playlists]));

  return playlists;
}

/**
 * Custom React hook to track whether the current user is the host.
 * 
 * @param controller The RoomController instance to listen to.
 * @returns A boolean indicating whether the current user is the host.
 */
export function useIsHost(controller: RoomController) {
  const [isHost, setIsHost] = useState(false);

  useRoomControllerListener(controller, useCallback((msg) => {
    if (!msg || msg.type === "update") setIsHost(controller.isHost);
  }, [controller.isHost]));

  return isHost;
}