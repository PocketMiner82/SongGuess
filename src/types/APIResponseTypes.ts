/**
 * Response returned by GET request to a /parties/song-guess-server/{roomId}.
 */
export interface RoomGetResponse {
  /**
   * The amount of players online in the room
   * @see {@link SongGuessServer#getActivePlayersCount}
   */
  onlineCount: number;

  /**
   * True, if this room was created by a request to /createRoom
   * @see {@link SongGuessServer#isValidRoom}
   */
  isValidRoom: boolean;
}

/**
 * Response returned by /api/createRoom endpoint.
 */
export interface CreateRoomResponse {
  /**
   * The ID of the created room
   */
  roomID: string;

  /**
   * If an error happened, this will contain the error message
   */
  error: string;
}
