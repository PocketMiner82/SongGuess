enum GamePhase {
  /**
   * Picking phase, where the question(s) for this round get picked.
   */
  PICKING,

  /**
   * Question first shown phase. This is where audio should be downloaded.
   */
  QUESTION,

  /**
   * Answering phase. This is where audio should start and while in this phase, players can answer.
   */
  ANSWERING,

  /**
   * The phase where the correct answer is shown.
   */
  ANSWER,

  /**
   * Shortly before the next round starts, the music should get paused.
   */
  PAUSE_MUSIC,
}

export default GamePhase;
