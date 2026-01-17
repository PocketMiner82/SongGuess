import chroma from "chroma-js";
import type {PlayerState} from "../../../types/MessageTypes";


/**
 * Calculates whether black or white has better contrast against
 * the given color for readability.
 * 
 * @param colorName The background color in any valid CSS format
 * @returns "#000" (black) or "#fff" (white)
 */
function getMaxContrastColor(colorName: string|undefined): string|undefined {
  if (!colorName) {
    return undefined;
  }

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
export function PlayerAvatar({size, player} : {size: number, player: PlayerState|null}) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-xl font-bold bg-disabled-bg text-disabled-text"
      style={{
        backgroundColor: player?.color,
        color: getMaxContrastColor(player?.color),
        minWidth: size,
        minHeight: size,
        fontSize: size / 2.2,
      }}
    >
      {player ?
        player.username.charAt(0).toUpperCase()
      :
        "+"}
    </div>
  );
}