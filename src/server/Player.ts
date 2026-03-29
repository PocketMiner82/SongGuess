import type * as Party from "partykit/server";
import type {
  ChangeUsernameMessage,
  PlayerMessage,
  PlayerAnswerData,
  SelectAnswerMessage, ServerMessage, SourceMessage, ConfirmationMessage, ClientMessage
} from "../types/MessageTypes";
import type {ValidRoom} from "./ValidRoom";
import {usernameRegex} from "../schemas/ValidationRegexes";
import {adjectives, nouns, uniqueUsernameGenerator} from "unique-username-generator";
import {ROOM_INACTIVITY_KICK_TIMEOUT} from "../ConfigConstants";
import {PlayerMessageSchema} from "../schemas/ServerMessageSchemas";
import GamePhase from "./game/GamePhase";
import {version} from "../../package.json";
import type {IEventListener} from "./listener/IEventListener";


export default class Player implements PlayerMessage, IEventListener {
  username: string = "";

  color: string = "";

  points: number = 0;

  answerData?: PlayerAnswerData;

  /**
   * Holds the Timeout which will kick the player after inactivity.
   */
  kickPlayerTimeout?: NodeJS.Timeout;

  /**
   * Whether this player is a spectator.
   */
  isSpectator: boolean = false;

  /**
   * Whether the player is marked as online.
   */
  isOnline: boolean = false;


  constructor(readonly room: ValidRoom, readonly conn: Party.Connection) {
    room.listener.registerEvents(this);
  }

  /**
   * Must be called when this player connects to the room.
   * @returns false if the room is full.
   */
  onConnect(ctx: Party.ConnectionContext): boolean {
    let url = new URL(ctx.request.url);
    this.isSpectator = url.searchParams.get("spectator") !== null;

    let color = this.room.getUnusedColors()[0];
    if (!color && !this.isSpectator) {
      this.kick(4002, "Room is full.");
      return false;
    }

    this.room.activePlayers.push(this);

    let requestedUsername = url.searchParams.get("username");
    let usernameValid = requestedUsername && usernameRegex.test(requestedUsername);
    if (!usernameValid || !this.changeUsername(requestedUsername!)) {
      if (requestedUsername && !usernameValid) {
        this.sendConfirmationOrError({
          type: "change_username",
          username: "?"
        } satisfies ChangeUsernameMessage, "Username reset because it was invalid.");
      } else if (requestedUsername) {
        this.sendConfirmationOrError({
          type: "change_username",
          username: requestedUsername!
        } satisfies ChangeUsernameMessage, "Username reset because someone in the room already uses that name.");
      }

      this.username = uniqueUsernameGenerator({
        dictionaries: [adjectives, nouns],
        style: "titleCase",
        length: 16
      });
    }

    // clear cached answer when we're already at the next question
    if (this.answerData?.questionNumber !== this.room.game.currentQuestion || this.room.state !== "ingame") {
      // reset points only if in lobby
      this.resetAnswerData(this.room.state === "lobby");
    }

    // send the current playlist to the connection
    this.safeSend(this.room.lobby.getPlaylistsUpdateMessage());

    // send played songs to client
    if (this.room.state === "results") {
      this.safeSend(this.room.game.getPlayedSongsUpdateMessage());
    }

    // send current config
    this.safeSend(this.room.config.toConfigMessage());

    // inform client about current round state
    this.room.game.getGameMessages(true)
        .forEach(msg => this.safeSend(msg));

    // send client's answer if client selected one previously
    if (this.answerData?.answerIndex !== undefined) {
      this.sendConfirmationOrError({
        type: "select_answer",
        answerIndex: this.answerData.answerIndex
      } satisfies SelectAnswerMessage);
    }

    // kicks player if inactive
    this.refreshKickTimeout();
    this.isOnline = true;
    return true;
  }

  onMessage(player: Player, msg: ClientMessage): boolean {
    if (player !== this) {
      return false;
    }

    switch (msg.type) {
      case "change_username":
        this.handleUsernameChangeRequest(msg);
        return true;
    }
    return false;
  }

  onClose() {
    // always remove inactive player timeout
    if (this.kickPlayerTimeout) {
      clearTimeout(this.kickPlayerTimeout);
      this.kickPlayerTimeout = undefined;
    }

    this.isOnline = false;
  }

  /**
   * Safely sends a JSON-serialized message to an online player.
   *
   * @param msg The message object to be stringified and transmitted to the client.
   * @param log Whether to log the sent message
   */
  public safeSend(msg: ServerMessage, log:boolean = true) {
    // silently ignore if not online
    if (this.isOnline) {
      this.room.server.safeSend(this.conn, msg, log);
    }
  }

  /**
   * Sends a confirmation or error message to the player.
   *
   * @param source The source/type of the confirmation message
   * @param error An optional error message to include in the confirmation
   */
  public sendConfirmationOrError(source: SourceMessage, error?: string) {
    let resp: ConfirmationMessage = {
      type: "confirmation",
      sourceMessage: source,
      error: error
    }

    this.safeSend(resp);
  }

  /**
   * Constructs and sends an update message with the current room/connection states to the player.
   */
  public sendUpdateMessage() {
    this.safeSend({
      type: "update",
      version: version,
      state: this.room.state,
      players: this.room.getActivePlayerMessages(),
      username: this.username,
      color: this.color,
      isHost: this === this.room.host
    });
  }

  /**
   * Kicks this player from the room and mark it as offline.
   * @param code the code to use when closing the socket.
   * @param msg the message to send with the code.
   */
  public kick(code: number, msg: string) {
    this.onClose();
    this.conn.close(code, msg);
  }

  /**
   * Handles a username change requested by the player.
   *
   * @param msg The message with the username change request.
   */
  public handleUsernameChangeRequest(msg: ChangeUsernameMessage) {
    if (this.changeUsername(msg.username)) {
      // inform all players about the username change + send confirmation to the user
      this.room.broadcastUpdateMessage();
      this.sendConfirmationOrError(msg);
    } else {
      this.sendUpdateMessage();
      this.sendConfirmationOrError(msg, "Username is already taken.");
    }
  }

  /**
   * Changes the username for this player.
   * @param username - The new username to set
   * @returns true if the username was successfully changed, false if it's already in use
   */
  public changeUsername(username: string): boolean {
    // username is already validated, just check if it's used by another player
    if (this.room.activePlayers.some(player => player !== this && player.username === username)) {
      return false;
    }
    this.username = username;

    return true;
  }

  /**
   * Resets the inactivity timer for a specific player connection.
   * If the timer expires before being refreshed again, the connection is closed.
   */
  public refreshKickTimeout() {
    if (this.kickPlayerTimeout) {
      clearTimeout(this.kickPlayerTimeout);
    }

    this.kickPlayerTimeout = setTimeout(() => {
      this.room.server.logger.info(`Kicked ${this.conn.id} due to inactivity.`);
      this.kick(4001, "Didn't receive updates within 15 seconds.");
    }, ROOM_INACTIVITY_KICK_TIMEOUT * 1000);
  }

  /**
   * Removes current answer data from a connection.
   * @param resetPoints whether to also reset the points of a player.
   * @public
   */
  public resetAnswerData(resetPoints:boolean = false): void {
    this.answerData = undefined;
    if (resetPoints) {
      this.points = 0;
    }
  }

  /**
   * Constructs a player update message.
   *
   * @returns a JSON string of the constructed {@link PlayerMessage}
   */
  public toPlayerMessage(): PlayerMessage {
    const baseKeys = Object.keys(PlayerMessageSchema.shape);

    // only send full state when answer is already shown, otherwise remove it
    if (this.room.game.gamePhase !== GamePhase.ANSWER) {
      baseKeys.splice(baseKeys.indexOf("answerData"), 1);
    }

    const entries = baseKeys.map(key => [key, this[key as keyof this]]);
    return Object.fromEntries(entries);
  }
}