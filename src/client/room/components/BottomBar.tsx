import { useState, useCallback } from 'react';
import { type ReactNode } from 'react';
import { useControllerContext, useRoomControllerListener } from '../RoomController';
import type { ServerMessage } from '../../../schemas/RoomMessageSchemas';

/**
 * Props for the BottomBar component.
 */
type BottomBarProps = {
  /**
   * Additional elements to render on the right side of the bottom bar.
   * These can be positioned independently from the audio controls.
   */
  children?: ReactNode;
  
  /**
   * Additional CSS classes to apply to the bottom bar.
   */
  className?: string;
};

/**
 * Bottom bar component for the game room that contains audio controls.
 * Displays a volume slider with appropriate icons based on the current volume level.
 * Allows for additional elements to be positioned independently on the right side.
 */
export function BottomBar({
  children,
  className = ''
}: BottomBarProps) {
  const audio = document.getElementById("audio") as HTMLAudioElement;
  const controller = useControllerContext();
  const [volume, setVolume] = useState(0.2);

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "audio_control") {
      return;
    }

    audio.volume = volume;

    // perform requested action
    switch (msg.action) {
      case "pause":
        audio.pause();
        return;
      case "play":
        audio.play().catch(() => {/* ignore play promise errors */});
        return;
      case "load":
        const currentAudioURL = msg.audioURL;
        // avoid resetting src if it is already correct
        if (audio.src !== currentAudioURL) audio.src = currentAudioURL;

        audio.load();
        break;
    }
  }, [audio, volume]);

  useRoomControllerListener(controller, listener);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
  };

  const getVolumeIcon = () => {
    if (volume === 0) return "volume_mute";
    if (volume <= 0.5) return "volume_down";
    return "volume_up";
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-default-bg border-t border-gray-300 dark:border-gray-700 z-50 ${className}`}>
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <span className="material-icons text-default">{getVolumeIcon()}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-25"
          />
        </div>
        
        <div className="flex-1 flex justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}