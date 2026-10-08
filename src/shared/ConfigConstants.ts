/**
 * Available player colors that can be assigned to players in the game room.
 */
export const COLORS = ["Red", "DarkGreen", "Blue", "Orange", "LawnGreen", "Black", "White", "Cyan", "Purple", "Pink", "Yellow", "Brown", "Gray", "Magenta", "Teal", "Olive"];

/**
 * The time (in seconds) after which an empty room is cleaned up.
 */
export const ROOM_CLEANUP_TIMEOUT = 172800;

/**
 * The time (in seconds) after the host leaved where a new player will get host.
 */
export const ROOM_HOST_TRANSFER_TIMEOUT = 15;

/**
 * The total amount of songs all playlists in the lobby can have at max.
 */
export const ROOM_MAX_SONG_COUNT = 2000;

/**
 * The time (in seconds) after which an inactive player will get kicked.
 */
export const ROOM_INACTIVITY_KICK_TIMEOUT = 15;

/**
 * The tick count when a new round starts.
 */
export const QUESTION_ROUND_START_TICK = 0;

/**
 * The tick count BEFORE the pick phase ends, when the first warning sound effect gets played.
 */
export const QUESTION_ROUND_PICK_PHASE_FIRST_WARNING_TICK = 30;

/**
 * The tick count BEFORE the pick phase ends, where from now on every tick a warning sound gets played.
 */
export const QUESTION_ROUND_PICK_PHASE_CONTINUOUS_WARNING_TICK = 10;

/**
 * The amount of ticks before and after a question is/was displayed.
 */
export const QUESTION_PADDING_TICKS = 5;

/**
 * The maximum amount of time music can play (in seconds).
 */
export const QUESTION_MAX_MUSIC_PLAY_TIME = 30;

/**
 * How many points a player can get per question.
 * Half of the points are for a correct answer, the other half is for the speed of the answer if correct.
 */
export const QUESTION_MAX_POINTS = 1000;

/**
 * Minimum similarity required to score in a player picks game.
 * Points are scaled linearly from that point until 100%.
 */
export const QUESTION_ANSWER_MIN_SIMILARITY = 50;

/**
 * Amount of milliseconds to wait before attempting to auto reconnect.
 */
export const AUTO_RECONNECT_WAIT_MS = 500;

/**
 * The minimum close code used.
 */
export const CLOSE_CODE_MIN = 4000;

/**
 * The close code used for a wrong version number.
 */
export const CLOSE_CODE_WRONG_VERSION = 4000;

/**
 * The close code used when the room id was not found
 */
export const CLOSE_CODE_ROOM_NOT_FOUND = 4001;

/**
 * The close code used when player gets kicked due to inactivity.
 */
export const CLOSE_CODE_INACTIVE = 4002;

/**
 * The close code used when room is full.
 */
export const CLOSE_CODE_ROOM_FULL = 4003;

/**
 * The close code used when username generation failed (no unique username found).
 */
export const CLOSE_CODE_USERNAME_GENERATION_FAILURE = 4004;

/**
 * The close code used when access was denied to an admin.
 */
export const CLOSE_CODE_ACCESS_DENIED = 4403;
