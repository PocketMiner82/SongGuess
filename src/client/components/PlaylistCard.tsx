import type { ReactNode } from "react";
import type ICookieProps from "../../types/ICookieProps";
import { useEffect, useRef, useState } from "react";
import { useCookies } from "react-cookie";

/**
 * Displays a single playlist entry with cover art, title and subtitle.
 * Shows a delete button for hosts.
 *
 * @param index The playlist's position in the list
 * @param title The primary display name
 * @param subtitle Optional secondary text
 * @param coverURL URL for the cover image or null
 * @param hrefURL URL to open in new tab when clicking the title.
 * @param children What to show at the right part of the card (e.g. a button)
 * @param previewURL The preview url for this playlist, used to show audio player preview.
 */
export function PlaylistCard({ title, subtitle, coverURL, hrefURL, children, previewURL }: {
  title: string;
  subtitle?: string;
  coverURL?: string | null;
  hrefURL?: string;
  showDelete?: boolean;
  children?: ReactNode;
  previewURL?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cookies] = useCookies<"audioVolume", ICookieProps>(["audioVolume"]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = cookies.audioVolume ?? 0.2;
    }
  }, [cookies.audioVolume]);

  const handlePlayPause = () => {
    if (!audioRef.current)
      return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    const handleEnded = () => setIsPlaying(false);
    if (audio) {
      audio.addEventListener("ended", handleEnded);
    }
    return () => {
      if (audio) {
        audio.removeEventListener("ended", handleEnded);
      }
    };
  }, []);

  return (
    <li className="flex items-center gap-6 p-3 bg-card-bg rounded-lg">
      {coverURL
        ? (
            <div className="relative max-w-25 max-h-25 lg:max-w-30 lg:max-h-30 2xl:max-w-40 2xl:max-h-40">
              <img src={coverURL} alt="Album Cover" className="object-cover rounded-xl w-full h-full" />
              {previewURL && (
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl hover:bg-black/50 hover:cursor-pointer transition-colors"
                  aria-label={isPlaying ? "Stop preview" : "Play preview"}
                >
                  <span className="material-icons text-white text-3xl">{isPlaying ? "stop" : "play_arrow"}</span>
                </button>
              )}
            </div>
          )
        : (
            <div className="relative min-w-25 min-h-25 lg:min-w-30 lg:min-h-30 2xl:min-w-40 2xl:min-h-40 rounded-xl bg-disabled-bg flex items-center justify-center">
              <span className="text-disabled-text text-4xl">?</span>
              {previewURL && (
                <button
                  type="button"
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl hover:bg-black/50 transition-colors"
                  aria-label={isPlaying ? "Stop preview" : "Play preview"}
                >
                  <span className="material-icons text-white text-3xl">{isPlaying ? "stop" : "play_arrow"}</span>
                </button>
              )}
            </div>
          )}
      <div className="w-full">
        {hrefURL
          ? (
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={hrefURL}
                className="text-xl font-medium wrap-break-word hover:underline hover:cursor-pointer"
              >
                {title}
              </a>
            )
          : (
              <span className="text-xl font-medium wrap-break-word">{title}</span>
            )}

        {subtitle && <div className="mt-1 text-sm text-disabled-text block">{subtitle}</div>}

        {previewURL && (
          <>
            <audio ref={audioRef} src={previewURL} preload="none">
              <track kind="captions" label="No captions available" default />
            </audio>
          </>
        )}
      </div>
      <div className="flex items-center justify-center">
        {children}
      </div>
    </li>
  );
}
