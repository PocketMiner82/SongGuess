import React, { useCallback, useRef, useEffect, useState } from 'react';
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
  const [targetVolume, setTargetVolume] = useState(cookies.audioVolume || 0.2);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  if (cookies.audioVolume === undefined) setCookie('audioVolume', 0.2);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!audioRef.current) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = audioRef.current;
    const initialVolume = audio.volume;
    const fadeSteps = 20;
    const stepDuration = duration / fadeSteps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = initialVolume * (1 - currentStep / fadeSteps);
      audio.volume = Math.max(0, newVolume);

      if (currentStep >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }
    }, stepDuration);
  }, []);

  const fadeIn = useCallback((duration: number = 1000) => {
    if (!audioRef.current) return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = audioRef.current;
    const finalVolume = targetVolume;
    const fadeSteps = 20;
    const stepDuration = duration / fadeSteps;
    let currentStep = 0;
    audio.volume = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = finalVolume * (currentStep / fadeSteps);
      audio.volume = Math.min(finalVolume, newVolume);

      if (currentStep >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }
    }, stepDuration);
  }, [targetVolume]);

  useRoomControllerListener(controller, useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "audio_control" || !audioRef.current) {
      return false;
    }

    const audio = audioRef.current;

    // perform requested action
    switch (msg.action) {
      case "load":
        const currentAudioURL = msg.audioURL;
        // avoid resetting src if it is already correct
        if (audio.src !== currentAudioURL) audio.src = currentAudioURL;

        audio.load();
        break;
      case "play":
        if (audio.paused) {
          audio.volume = 0;
          audio.play().catch(e => {
            console.error("Failed to start playback:", e);
          });
          fadeIn();
        }
        break;
      case "pause":
        fadeOut();
        setTimeout(() => audio.pause(), 1000);
        break;
    }
    return false;
  }, [fadeIn, fadeOut]));

  useEffect(() => {
    if (audioRef.current && cookies.audioVolume !== undefined) {
      audioRef.current.volume = cookies.audioVolume;
      audioRef.current.muted = cookies.audioMuted === true;
      setTargetVolume(cookies.audioVolume);
    }
  }, [cookies.audioMuted, cookies.audioVolume]);

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