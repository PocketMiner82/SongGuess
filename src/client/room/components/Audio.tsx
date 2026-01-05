import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useControllerContext, useRoomControllerListener } from '../RoomController';
import type { ServerMessage } from '../../../schemas/RoomMessageSchemas';

/**
 * Audio component that handles audio playback and controls.
 * Manages audio element, volume control, and responds to server audio control messages.
 */
export function Audio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useControllerContext();
  const [volume, setVolume] = useState(0.2);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "audio_control" || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;
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
  }, [volume]);

  useRoomControllerListener(controller, listener);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    // Unmute if volume is increased from 0
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const getVolumeIcon = () => {
    if (isMuted) return 'volume_off';
    if (volume === 0) return "volume_mute";
    if (volume <= 0.5) return "volume_down";
    return "volume_up";
  };

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="flex items-center gap-2">
        <button
          onClick={handleMuteToggle}
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <span className="material-icons text-default">
            {getVolumeIcon()}
          </span>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-25 align-middle"
        />
      </div>
    </>
  );
}