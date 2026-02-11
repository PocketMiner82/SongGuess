/**
 * Available player colors that can be assigned to players in the game room.
 */
export const COLORS = ["Red", "DarkGreen", "Blue", "Orange", "LawnGreen", "Black", "White", "Cyan", "Purple", "Pink", "Yellow", "Brown"];

/**
 * The time (in seconds) after which an empty room is cleaned up.
 */
export const ROOM_CLEANUP_TIMEOUT = 30;

/**
 * The time (in seconds) after the host leaved where a new player will get host.
 */
export const ROOM_HOST_TRANSFER_TIMEOUT = 10;

/**
 * The time (in seconds) after which an inactive player will get kicked.
 */
export const ROOM_INACTIVITY_KICK_TIMEOUT = 15;

/**
 * The tick count when a round starts.
 */
export const ROUND_START_TICK = 0;

/**
 * The amount of ticks before and after a question is/was displayed.
 */
export const ROUND_PADDING_TICKS = 5;

/**
 * The maximum amount of time music can play (in seconds).
 */
export const ROUND_MAX_MUSIC_PLAY_TIME = 30;

/**
 * How many points a player can get per question.
 * Half of the points are for a correct answer, the other half is for the speed of the answer if correct.
 */
export const ROUND_POINTS_PER_QUESTION = 1000;

/**
 * The amount of ticks per second.
 */
export const TICKS_PER_SECOND = 1;