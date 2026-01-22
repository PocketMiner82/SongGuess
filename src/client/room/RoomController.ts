import PartySocket from "partysocket";
import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from "react";
import type {CloseEvent, ErrorEvent} from "partysocket/ws";
import z from "zod";
import { ServerMessageSchema } from "../../schemas/MessageSchemas";
import type {CookieGetter, CookieSetter} from "../../types/CookieFunctionTypes";
import {v4 as uuidv4} from "uuid";
import {getPlaylistByURL} from "../../Utils";
import { version } from "../../../package.json";
import type {
  AddPlaylistsMessage,
  AnswerMessage, AudioControlMessage, ChangeUsernameMessage,
  GameState, PingMessage,
  PlayerState,
  Playlist, PlaylistsFile,
  QuestionMessage, RemovePlaylistMessage, ReturnToMessage, SelectAnswerMessage,
  ServerMessage, Song, StartGameMessage
} from "../../types/MessageTypes";
import {BaseConfig} from "../../BaseConfig";


/**
 * The PartyKit host URL for WebSocket connections.
 */
declare const PARTYKIT_HOST: string;


/**
 * A callback function that receives the RoomController instance when its state changes and returns a boolean
 * to indicate whether the update should trigger a component update, therefore also making new controller accissible.
 */
type ListenerCallback = (msg: ServerMessage | null) => boolean;


/**
 * Custom React hook that provides a {@link RoomController} instance for managing
 * the connection and state of a room.
 *
 * @param roomID The ID of the room to connect to.
 * @param getCookies What cookies are currently set.
 * @param setCookies A function to allow updating cookies.
 * @returns An object containing a `getController` method to access the `RoomController` instance.
 */
export function useRoomController(roomID: string, getCookies: CookieGetter, setCookies: CookieSetter) {
  // hold the class instance so it persists across renders
  const controllerRef = useRef<RoomController | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // initialize the controller
    controllerRef.current = new RoomController(roomID, getCookies, setCookies);
    setIsReady(true);

    return () => {
      controllerRef.current?.destroy();
    };
    // only update on roomID change
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
 * @param cb The {@link ListenerCallback} function.
 */
export function useRoomControllerListener(controller: RoomController, cb: ListenerCallback) {
  const [updateVal, updateComponent] = React.useState(false);
  const forceUpdateComponent = React.useCallback(() => updateComponent(!updateVal), [updateVal]);

  useEffect(() => {
    if (cb(null)) {
      forceUpdateComponent();
    }

    return controller.registerOnStateChangeListener(msg => {
      let update = cb(msg);
      if (update) {
        forceUpdateComponent();
      }
      return update;
    });
  }, [controller, cb, forceUpdateComponent]);
}


/**
 * A wrapper around {@link useRoomControllerListener} that forces a React update when the specified message is received.
 * @param controller The RoomController instance to listen to.
 * @param msgType The {@link ServerMessage["type"]} to listen for.
 */
export function useRoomControllerMessageTypeListener(controller: RoomController, msgType: ServerMessage["type"]|null) {
  useRoomControllerListener(controller, useCallback(msg => {
    return (msg?.type ?? null) === msgType;
  }, [msgType]));
}


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
  private stateChangeEventListeners: ListenerCallback[] = [];

  /**
   * The current list of players in the room.
   */
  players: PlayerState[] = [];

  /**
   * The current username of the player.
   */
  username: string = "Unknown";

  /**
   * Whether the current player is the host of the room.
   */
  isHost: boolean = false;

  /**
   * The current list of playlists selected for the game.
   */
  playlists: Playlist[] = [];

  /**
   * The current game state.
   */
  state: GameState = "lobby";

  /**
   * The current question being asked to players.
   */
  currentQuestion: QuestionMessage|null = null;

  /**
   * The current answer information revealed after question ends.
   */
  currentAnswer: AnswerMessage|null = null;

  /**
   * The list of songs played in the last round.
   */
  playedSongs: Song[] = [];

  /**
   * The amount of filtered songs
   */
  filteredSongsCount: number = 0;

  /**
   * The config of this room
   */
  config: BaseConfig = new BaseConfig();

  /**
   * The interval of the ping function.
   */
  pingInterval?: number;

  /**
   * The current ping sequence number.
   */
  pingSeq: number = 0;

  /**
   * The last received sequence number by the server.
   */
  pongSeq: number = 0;

  /**
   * The performance.now() timestamp when the last ping was sent.
   */
  pingStart: number = 0;

  /**
   * The current ping in milliseconds.
   */
  currentPingMs: number = -1;

  /**
   * The current state of the audio playback
   */
  currentAudioState: AudioControlMessage["action"]|null = null;

  /**
   * The length of the current audio.
   */
  currentAudioLength: number = 0;


  /**
   * Creates a new RoomController instance and initializes the socket connection.
   *
   * @param roomID The ID of the room to connect to.
   * @param getCookies What cookies are currently set.
   * @param setCookies A function to allow updating cookies.
   */
  constructor(roomID: string, readonly getCookies: CookieGetter, readonly setCookies: CookieSetter) {
    // generate uuid if not set via cookie
    let id = getCookies().userID ? getCookies().userID : uuidv4();

    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomID,
      maxRetries: 0,
      id: id
    });

    if (!getCookies().userID) {
      this.setCookies("userID", id);
    }

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

    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
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
   * @param listener The {@link ListenerCallback} function.
   * @returns A function to unregister the listener.
   */
  public registerOnStateChangeListener(listener: ListenerCallback) {
    this.stateChangeEventListeners.push(listener);
    return () => this.unregisterOnStateChangeListener(listener);
  }

  /**
   * Unregisters a previously registered state change listener.
   * @param listener The {@link ListenerCallback} function.
   */
  public unregisterOnStateChangeListener(listener: ListenerCallback) {
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

    // send username cookie if saved
    if (this.getCookies().userName) {
      this.updateUsername(this.getCookies().userName!);
    }

    // send a ping every second
    this.pingInterval = window.setInterval(() => this.sendPing(), 1000);
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
   * Sends a ping with the current sequence number to the server and tracks the start timestamp.
   */
  private sendPing() {
    // wait until server answers first ping
    if (this.pingSeq !== this.pongSeq)
      return;

    this.pingStart = performance.now();
    this.socket.send(JSON.stringify({
      type: "ping",
      seq: ++this.pingSeq
    } satisfies PingMessage));
  }

  /**
   * Handles incoming messages from the server.
   * 
   * @param ev The MessageEvent containing the server message.
   */
  private onMessage(ev: MessageEvent) {
    // try to parse JSON
    try {
      // noinspection ES6ConvertVarToLetConst
      var json = JSON.parse(ev.data);
    } catch (e) {
      console.debug("Server sent:", ev.data);
      console.error("Server sent invalid JSON:", e);
      return;
    }

    // check if received message is valid
    const result = ServerMessageSchema.safeParse(json);
    if (!result.success) {
      console.debug("Server sent:", ev.data);
      console.error("Server sent invalid data:\n%s", z.prettifyError(result.error));
      return;
    }

    let msg: ServerMessage = result.data;

    // don't log ping/pong
    if (msg.type !== "ping" && msg.type !== "pong")
      console.debug("Server sent:", ev.data);

    switch (msg.type) {
      case "pong":
        this.currentPingMs = Math.round(performance.now() - this.pingStart);
        this.pongSeq = msg.seq;
        break;
      case "confirmation":
        if (msg.error) {
          console.error(`Server reported an error for ${msg.sourceMessage.type}:\n${msg.error}`);
        }
        break;
      case "update":
        // force hard reload when version is outdated
        if (msg.version !== version) {
          alert("Client outdated. Click OK to reload the page and try again.\n\n"
              + "If reloading doesn't work after some waiting, try pressing CTRL+SHIFT+R or delete all cookies and data from this page.");

          // try reloading with refreshing cache
          try {
            // @ts-ignore
            window.location.reload(true);
          } catch {
            window.location.reload();
          }

          return;
        }

        this.username = msg.username;
        this.setCookies("userName", msg.username);
        this.players = msg.players;
        this.isHost = msg.isHost;
        this.state = msg.state;
        break;
      case "room_config":
        this.config = new BaseConfig(msg);
        break;
      case "update_playlists":
        this.playlists = msg.playlists;
        this.filteredSongsCount = msg.filteredSongsCount;
        break;
      case "question":
        this.currentQuestion = msg;
        this.currentAnswer = null;
        break;
      case "answer":
        this.currentAnswer = msg;
        this.currentQuestion = null;
        break;
      case "update_played_songs":
        this.playedSongs = msg.songs;
        break;
      case "audio_control":
        this.currentAudioState = msg.action;
        this.currentAudioLength = msg.length
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
   * Asks the server to update config.
   */
  public sendConfig() {
    this.socket.send(this.config.getConfigMessage());
  }

  /**
   * Serializes the current collection of playlists into a standardized JSON string.
   */
  public generatePlaylistsFile(): string {
    let data: PlaylistsFile = {
      version: "1.0",
      playlists: this.playlists
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Imports playlists from a validated PlaylistsFile object.
   * @param playlistsFile The validated PlaylistsFile object containing playlist data.
   */
  public importPlaylistsFromFile(playlistsFile: PlaylistsFile) {
    if (this.playlists.length > 0) {
      let isConfirmed = window.confirm("Do you want to clear the old playlists first?");
      if (isConfirmed) {
        // clear old playlists
        this.removePlaylist(null);
      }
    }

    this.addPlaylists(...playlistsFile.playlists);
  }

   /**
    * Sends the selected answer to the server.
    * @param answerIndex The index of the selected answer (0-3).
    */
  public selectAnswer(answerIndex: number) {
    this.socket.send(JSON.stringify({
      type: "select_answer",
      answerIndex
    } satisfies SelectAnswerMessage));
  }

  /**
   * Requests the server to return to the lobby.
   * @param where {@link ReturnToMessage["where"]}
   */
  public returnTo(where: ReturnToMessage["where"]) {
    this.socket.send(JSON.stringify({
      type: "return_to",
      where: where
    } satisfies ReturnToMessage));
  }

  /**
   * Requests the server to remove a playlist from the list.
   * @param index the index of the playlist to remove. null to remove all playlists.
   */
  public removePlaylist(index: number|null) {
    let req: RemovePlaylistMessage = {
      type: "remove_playlist",
      index: index
    };

    this.socket.send(JSON.stringify(req));
  }

  /**
   * Attempts to add multiple playlists from a given list (newline-separated) of Apple Music URLs.
   * @see tryAddPlaylist
   * @returns true, if all playlists were requested to be added without errors.
   */
  public async tryAddPlaylists(url: string): Promise<boolean> {
    let urls: string[] = url.split(";");

    const results: boolean[] = await Promise.all(
      urls.map(u => this.tryAddPlaylist(u))
    );

    return results.every(result => result);
  }

  /**
   * Attempts to add a playlist from the given Apple Music URL.
   * If the URL is valid and songs are found, it sends an update to the server.
   * 
   * @param url The Apple Music URL of the artist, song or album.
   * @returns true if the playlist was requested to be added, false otherwise.
   */
  public async tryAddPlaylist(url: string): Promise<boolean> {
    let playlist = await getPlaylistByURL(url);

    if (!playlist) return false;

    this.addPlaylists(playlist);

    return true;
  }

  /**
   * Requests the server to add a playlist
   * @param playlists the playlists to add
   */
  public addPlaylists(...playlists: Playlist[]) {
    const req: AddPlaylistsMessage = {
      type: "add_playlists",
      playlists: playlists
    };
    this.socket.send(JSON.stringify(req));
  }
}