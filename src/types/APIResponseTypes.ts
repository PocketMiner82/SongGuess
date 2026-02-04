/**
 * Response returned by GET request to a /parties/main/{roomId}.
 */
export type RoomGetResponse = {
  /**
   * The amount of players online in the room
   * @see {@link Server#getOnlinePlayersCount}
   */
  onlineCount: number,

  /**
   * True, if this room was created by a request to /createRoom
   * @see {@link Server#isValidRoom}
   */
  isValidRoom: boolean
}

/**
 * Response returned by /parties/api/createRoom endpoint.
 */
export type CreateRoomResponse = {
  /**
   * The ID of the created room
   */
  roomID: string,

  /**
   * If an error happened, this will contain the error message
   */
  error: string
}