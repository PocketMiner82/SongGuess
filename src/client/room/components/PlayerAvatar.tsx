import chroma from "chroma-js";
import type { PlayerState } from "../../../schemas/RoomServerMessageSchemas";


/**
 * Calculates whether black or white has better contrast against
 * the given color for readability.
 * 
 * @param colorName The background color in any valid CSS format
 * @returns "#000" (black) or "#fff" (white)
 */
function getMaxContrastColor(colorName: string): string {
  const color = chroma(colorName);
  const withBlack = chroma.contrast(color, "#000");
  const withWhite = chroma.contrast(color, "#fff");
  return withBlack > withWhite ? "#000" : "#fff";
}

/**
 * Displays a circular avatar for a player with their initial.
 * Shows a placeholder (+) for empty player slots.
 * 
 * @param size The diameter of the avatar in pixels
 * @param playerState The player's state or null for empty slot
 */
export function PlayerAvatar({size, playerState} : {size: number, playerState: PlayerState|null}) {
  return (
    <>
      {playerState ? (
        <div
          className="rounded-full flex items-center justify-center text-xl font-bold"
          style={{ 
            backgroundColor: playerState.color,
            color: getMaxContrastColor(playerState.color),
            width: size,
            height: size
          }}
        >
          {playerState.username.charAt(0).toUpperCase()}
        </div>
      ) : (
        <div className="rounded-full bg-disabled-bg flex items-center justify-center"
          style={{ 
            width: size,
            height: size
          }}
        >
          <span className="text-disabled-text text-xl">+</span>
        </div>
      )}
    </>
  );
}