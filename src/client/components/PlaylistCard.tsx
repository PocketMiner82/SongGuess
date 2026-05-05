import type { ReactNode } from "react";
import type ICookieProps from "../../types/ICookieProps";
import type { AudioPlayer } from "../room/audio/AudioPlayerHook";
import { useCookies } from "react-cookie";
import { ROUND_PADDING_TICKS } from "../../shared/ConfigConstants";
import { useAudioPlayer } from "../room/audio/AudioPlayerHook";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../room/RoomController";


interface PlaylistCardProps {
  /**
   * The primary display name.
   */
  title: string;

  /**
   * Optional secondary text.
   */
  subtitle?: string;

  /**
   * URL for the cover image or null.
   */
  coverURL?: string | null;

  /**
   * URL to open in a new tab when clicking the title.
   */
  hrefURL?: string;

  /**
   * Whether to display the delete action.
   */
  showDelete?: boolean;

  /**
   * Components rendered at the right portion of the card (e.g., a button).
   */
  children?: ReactNode;

  /**
   * The preview URL for this playlist, utilized to render the audio player preview.
   */
  previewURL?: string;

  /**
   * The start position for the audio preview. See {@link RoomConfigMessageSchema.audioStartPosition} (only 0-2 here!).
   */
  audioStartPos?: number;
}

function StateIcon({ state }: { state: AudioPlayer["state"] }) {
  const getIcon = () => {
    switch (state) {
      case "loading":
        return <span className="material-symbols-outlined animate-spin">progress_activity</span>;

      case "playing":
        return <span className="material-icons">stop</span>;

      case "not_playing":
        return <span className="material-icons">play_arrow</span>;
    }
  };

  return (
    <div className="text-white flex items-center justify-center text-3xl bg-black/50 rounded-full w-10 aspect-square">
      {getIcon()}
    </div>
  );
}

function stateToAriaLabel(state: AudioPlayer["state"]) {
  switch (state) {
    case "loading":
      return "Loading preview...";
    case "playing":
      return "Stop preview";
    case "not_playing":
      return "Start preview";
  }
}

/**
 * Displays a single playlist entry with cover art, title and subtitle.
 * Shows a delete button for hosts.
 */
export function PlaylistCard({ title, subtitle, coverURL, hrefURL, children, previewURL, audioStartPos }: PlaylistCardProps) {
  const controller = useControllerContext();
  const [cookies] = useCookies<"audioVolume" | "audioMuted", ICookieProps>(["audioVolume", "audioMuted"]);

  useRoomControllerMessageTypeListener(controller, "room_config");

  const player = useAudioPlayer(
    cookies.audioVolume ?? 0.2,
    cookies.audioMuted ?? false,
  );

  const handlePlayPause = () => {
    if (player.state === "not_playing") {
      player.load(previewURL!);
      player.playWithPositionAndFade(audioStartPos ?? 0, controller.config.timePerQuestion + ROUND_PADDING_TICKS);
    } else {
      player.howler?.pause();
    }
  };

  return (
    <li className="flex items-center gap-6 p-3 bg-card-bg rounded-lg">
      <div className="relative aspect-square flex-none flex w-25 lg:w-30 2xl:w-40 items-center justify-center bg-disabled-bg rounded-xl">
        {
          coverURL
            ? (
                <img
                  src={coverURL}
                  alt="Album Cover"
                  className="h-full w-full object-cover rounded-xl"
                />
              )
            : (
                <div className="rounded-xl text-disabled-text text-4xl">?</div>
              )
        }
        {previewURL && (
          <button
            type="button"
            onClick={handlePlayPause}
            className="absolute inset-0 flex items-center justify-center rounded-xl hover:bg-black/50 hover:cursor-pointer transition-colors"
            aria-label={stateToAriaLabel(player.state)}
          >
            <StateIcon state={player.state} />
          </button>
        )}
      </div>
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
      </div>
      <div className="flex items-center justify-center">
        {children}
      </div>
    </li>
  );
}
