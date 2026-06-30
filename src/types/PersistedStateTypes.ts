import type { GamePhase } from "../shared/game/GamePhase";
import type { GameState, PlayerMessage, Playlist, RoomConfigMessage, Song } from "./MessageTypes";


export interface PersistedPlayer extends PlayerMessage {
  connId: string;
  uuid: string;
}

export interface PersistedAbstractQuestion {
  startPos: number;
  song: Song;
}

export interface PersistedMultipleChoiceQuestion extends PersistedAbstractQuestion {
  answers: Song[];
}

export interface PersistedPlayerPicksQuestion extends PersistedAbstractQuestion {
  pickerId: string;
  questionCurrent: number;
}

export type PersistedQuestion = PersistedMultipleChoiceQuestion | PersistedPlayerPicksQuestion;

export interface PersistedAbstractGame {
  isRunning: boolean;
  questionTick: number;
  questionStartTime: number;
  gamePhase: GamePhase;
  currentQuestionIndex: number;
  roundCurrent: number;
}

export interface PersistedMultipleChoiceGame extends PersistedAbstractGame {
  type: "multiple_choice";
  questions: PersistedMultipleChoiceQuestion[];
  remainingSongs: Song[];
}

export interface PersistedPlayerPicksGame extends PersistedAbstractGame {
  type: "player_picks";
  questions: PersistedPlayerPicksQuestion[];
  nextQuestions: PersistedPlayerPicksQuestion[];
}

export type PersistedGame = PersistedMultipleChoiceGame | PersistedPlayerPicksGame;

export interface PersistedLobby {
  playlists: Playlist[];
}

export interface PersistedRoomState {
  config: RoomConfigMessage;
  game: PersistedGame;
  hostID?: string;
  lobby: PersistedLobby;
  players: PersistedPlayer[];
  state: GameState;
}

export interface PersistedServerState extends PersistedRoomState {
  // the version number of the current storage deployment
  // DO NOT REMOVE/RENAME
  version: number;
  // the room's name
  // DO NOT REMOVE/RENAME
  name: string;
}

/**
 * The version of this file. Should be changed when breaking changes are introduced in an update.
 */
export const PERSISTED_STATE_VERSION = 2;
