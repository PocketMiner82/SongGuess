import type { PlayerMessage } from "../../../types/MessageTypes";
import chroma from "chroma-js";
import { memo } from "react";


const contrastColorCache = new Map<string, string>();

/**
 * Calculates whether black or white has better contrast against
 * the given color for readability.
 *
 * @param colorName The background color in any valid CSS format
 * @returns "#000" (black) or "#fff" (white)
 */
function getMaxContrastColor(colorName: string | undefined): string | undefined {
  if (!colorName) {
    return undefined;
  }

  const cached = contrastColorCache.get(colorName);
  if (cached) {
    return cached;
  }

  const color = chroma(colorName);
  const withBlack = chroma.contrast(color, "#000");
  const withWhite = chroma.contrast(color, "#fff");
  const result = withBlack > withWhite ? "#000" : "#fff";
  contrastColorCache.set(colorName, result);
  return result;
}

/**
 * Displays a circular avatar for a player with their initial.
 * Shows a placeholder (+) for empty player slots.
 *
 * @param size The diameter of the avatar in pixels
 * @param playerState The player's state or null for empty slot
 */
export const PlayerAvatar = memo(({ size, player }: { size: number; player: PlayerMessage | null }) => {
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
      {player
        ? player.username.charAt(0).toUpperCase()
        : "+"}
    </div>
  );
});
