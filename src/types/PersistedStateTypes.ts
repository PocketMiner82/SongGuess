import type GamePhase from "../shared/game/GamePhase";
import type { GameState, PlayerAnswerData, Playlist, RoomConfigMessage, Song } from "./MessageTypes";


export interface PersistedPlayer {
  uuid: string;
  username: string;
  color: string;
  points: number;
  answerData?: PlayerAnswerData;
  isSpectator: boolean;
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
  nextQuestions: PersistedPlayerPicksQuestion[];
  questions: PersistedPlayerPicksQuestion[];
}

export type PersistedGame = PersistedMultipleChoiceGame | PersistedPlayerPicksGame;

export interface PersistedLobby {
  playlists: Playlist[];
  songs: Song[];
}

export interface PersistedRoomState {
  config: RoomConfigMessage;
  lobby: PersistedLobby;
  game: PersistedGame | null;
  hostID?: string;
  players: Record<string, PersistedPlayer>;
  state: GameState;
  countdown: number;
  // next tick due time (for gap calculation after eviction)
  gameTickDeadline?: number;
  // for countdown continuity
  countdownEndTime?: number;
  // the version number of the current storage deployment
  version: number;
}
