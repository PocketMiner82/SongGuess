/**
 * Available player colors that can be assigned to players in the game room.
 */
export const COLORS = ["Red", "DarkGreen", "Blue", "Orange", "LawnGreen", "Black", "White", "Cyan"];

/**
 * The time (in seconds) after which an empty room is cleaned up.
 */
export const ROOM_CLEANUP_TIMEOUT = 10;

/**
 * The number of questions to generate per game.
 */
export const QUESTION_COUNT = 10;

/**
 * The time allocated for each question in seconds.
 */
export const TIME_PER_QUESTION = 20;

/**
 * The tick count when a round starts.
 */
export const ROUND_START = 0;

/**
 * The tick count when music starts playing in a round.
 */
export const ROUND_START_MUSIC = 5;

/**
 * The tick count when the answer is revealed in a round.
 */
export const ROUND_SHOW_ANSWER = ROUND_START_MUSIC + TIME_PER_QUESTION;

export const ROUND_PAUSE_MUSIC = ROUND_SHOW_ANSWER + 5;

/**
 * The tick count when the next round starts.
 */
export const ROUND_START_NEXT = ROUND_PAUSE_MUSIC + 2;

/**
 * How many points a player can get per question.
 * Half of the points are for a correct answer, the other half is for the speed of the answer if correct.
 */
export const POINTS_PER_QUESTION = 1000;