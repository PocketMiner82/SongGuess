import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useControllerContext, useRoomControllerListener } from '../RoomController';
import {useCookies} from "react-cookie";
import type ICookieProps from "../../../types/ICookieProps";
import type {ServerMessage} from "../../../types/MessageTypes";
import {ROUND_PADDING_TICKS} from "../../../ConfigConstants";

/**
 * Audio component that handles audio playback and controls.
 * Manages audio element, volume control, and responds to server audio control messages.
 */
export function Audio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useControllerContext();
  const [cookies, setCookie] = useCookies<"audioVolume"|"audioMuted", ICookieProps>(["audioVolume", "audioMuted"]);
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
    console.debug("[Audio] fadeIn");
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
        console.debug("[Audio] fadeIn done");
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

    const setStartPosAndPlay = () => {
      let pos = controller.ingameData.currentAudioPosition;

      const startPosition = controller.config.audioStartPosition === 3 ? controller.ingameData.rndStartPos :
          controller.config.audioStartPosition;
      const audioPlayTime = controller.config.timePerQuestion + ROUND_PADDING_TICKS;
      switch (startPosition) {
        case 0:
          // 0 is start of audio, so nothing to change
          break;
        case 1:
          // middle of audio
          pos += Math.max(0, (audio.duration - audioPlayTime) / 2);
          break;
        case 2:
          // end of audio
          pos += Math.max(0, audio.duration - audioPlayTime - 0.5);
          break;
      }

      audio.currentTime = pos;

      audio.play().catch(e => {
        console.error("Failed to start playback:", e);
      });
      console.debug("[Audio] playing");
      fadeIn();
      audio.onloadedmetadata = null;
    };

    // perform requested action
    switch (msg.action) {
      case "load":
        console.log("[Audio] load");
        const currentAudioURL = msg.audioURL;
        // avoid resetting src if it is already correct
        if (audio.src !== currentAudioURL) audio.src = currentAudioURL;

        audio.load();
        break;
      case "play":
        console.log("[Audio] play");
        audio.volume = 0;

        try {
          setStartPosAndPlay();
        } catch {
          audio.onloadedmetadata = setStartPosAndPlay;
        }
        break;
      case "pause":
        console.log("[Audio] pause");
        fadeOut();
        setTimeout(() => audio.pause(), 1000);
        break;
    }
    return false;
  }, [controller.config.audioStartPosition, controller.config.timePerQuestion,
      controller.ingameData.currentAudioPosition, controller.ingameData.rndStartPos, fadeIn, fadeOut]));

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