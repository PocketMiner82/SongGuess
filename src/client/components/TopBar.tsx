import type { ReactNode } from "react";
import { useRef } from "react";
import { version } from "../../../package.json";
import { Button } from "./Button";

/**
 * Props for the TopBar component.
 */
interface TopBarProps {
  /**
   * Additional elements to render on the right side of the top bar.
   * These can be positioned independently of the centered "SongGuess" text.
   */
  children?: ReactNode;

  /**
   * Additional CSS classes to apply to the top bar.
   */
  className?: string;
}

function isAprilFools() {
  const today = new Date();
  return today.getMonth() === 3 && today.getDate() === 1;
}

/**
 * A top navigation bar component with centered "SongGuess" title that redirects to home.
 * Allows for additional elements to be positioned independently on the right side.
 *
 * @param props The top bar props including children elements and styling options.
 * @returns A styled top bar element.
 */
export function TopBar({
  children,
  className = "",
}: TopBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  return (
    <div className={`font-sans bg-default-bg border-b border-gray-300 dark:border-gray-700 z-50 ${className}`}>
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex-1">
          {isAprilFools()
            ? (
                <>
                  <audio ref={audioRef} preload="auto">
                    <source src="https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview116/v4/19/8b/c2/198bc2e8-87ca-5b6e-ac43-221c24a1e4f7/mzaf_5455311732429381454.plus.aac.ep.m4a" />
                  </audio>
                  <Button onClick={() => {
                    if (audioRef.current && audioRef.current.paused) {
                      audioRef.current.volume = 0.25;
                      audioRef.current.play().catch(() => {});
                    } else if (audioRef.current) {
                      audioRef.current.pause();
                    }
                  }}
                  >
                    Buy Premium
                  </Button>
                </>
              )
            : (
                <>
                  v
                  {version}
                </>
              )}

        </div>

        <a
          href="/"
          className="flex-1 text-center cursor-pointer focus-visible:ring-2 focus-visible:ring-secondary rounded"
        >
          <span className="text-2xl font-bold text-default">SongGuess</span>
        </a>

        <div className="flex-1 flex justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}
