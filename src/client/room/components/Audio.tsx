import React, { useCallback, useRef, useEffect } from 'react';
import { useControllerContext, useRoomControllerListener } from '../RoomController';
import type { ServerMessage } from '../../../schemas/RoomMessageSchemas';
import {useCookies} from "react-cookie";
import type CookieProps from "../../../types/CookieProps";

/**
 * Audio component that handles audio playback and controls.
 * Manages audio element, volume control, and responds to server audio control messages.
 */
export function Audio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useControllerContext();
  const [cookies, setCookie] = useCookies<"audioVolume"|"audioMuted", CookieProps>(["audioVolume", "audioMuted"]);
  if (cookies.audioVolume === undefined) setCookie('audioVolume', 0.2);

  useEffect(() => {
    if (audioRef.current && cookies.audioVolume !== undefined) {
      audioRef.current.volume = cookies.audioVolume;
      audioRef.current.muted = cookies.audioMuted === true;
    }
  }, [cookies.audioMuted, cookies.audioVolume]);

  useRoomControllerListener(controller, useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "audio_control" || !audioRef.current) {
      return;
    }

    const audio = audioRef.current;

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
  }, []));

  const getVolumeIcon = () => {
    if (cookies.audioMuted) return 'volume_off';
    if (cookies.audioVolume === 0) return "volume_mute";
    if (cookies.audioVolume! <= 0.5) return "volume_down";
    return "volume_up";
  };

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCookie("audioMuted", !cookies.audioMuted)}
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
          value={cookies.audioVolume}
          onChange={e => setCookie("audioVolume", parseFloat(e.target.value))}
          className="w-25 align-middle"
        />
      </div>
    </>
  );
}