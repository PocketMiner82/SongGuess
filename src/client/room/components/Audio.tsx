import type ICookieProps from "../../../types/ICookieProps";
import type { ServerMessage } from "../../../types/MessageTypes";
import { useCallback, useEffect, useRef } from "react";
import { useCookies } from "react-cookie";
import { ROUND_PADDING_TICKS } from "../../../ConfigConstants";
import { useControllerContext, useRoomControllerListener } from "../RoomController";

/**
 * Audio component that handles audio playback and controls.
 * Manages audio element, volume control, and responds to server audio control messages.
 */
export function Audio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const countdownRunningBufferRef = useRef<AudioBuffer | null>(null);
  const countdownDoneBufferRef = useRef<AudioBuffer | null>(null);
  const controller = useControllerContext();
  const [cookies, setCookie] = useCookies<"audioVolume" | "audioMuted", ICookieProps>(["audioVolume", "audioMuted"]);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  if (cookies.audioVolume === undefined)
    setCookie("audioVolume", 0.2);

  /**
   * Initializes the Web Audio API context for sound effects.
   * Creates and caches a single AudioContext instance with a gain node.
   * @returns The AudioContext instance
   */
  const initAudioContext = useCallback(() => {
    if (audioContextRef.current)
      return audioContextRef.current;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    return ctx;
  }, []);

  /**
   * Loads an audio file and decodes it into an AudioBuffer.
   * @param url - URL of the audio file to load
   * @returns The decoded AudioBuffer or null if loading fails
   */
  const loadAudioBuffer = useCallback(async (url: string): Promise<AudioBuffer | null> => {
    const ctx = initAudioContext();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      return await ctx.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.error(`[Audio] Failed to load buffer: ${url}`, e);
      return null;
    }
  }, [initAudioContext]);

  useEffect(() => {
    initAudioContext();
    loadAudioBuffer("/sounds/countdown_running_1.mp3").then((buffer) => {
      countdownRunningBufferRef.current = buffer;
    });
    loadAudioBuffer("/sounds/countdown_done_1.mp3").then((buffer) => {
      countdownDoneBufferRef.current = buffer;
    });
  }, [initAudioContext, loadAudioBuffer]);

  const playBuffer = useCallback((buffer: AudioBuffer | null) => {
    if (!buffer || !audioContextRef.current || !gainNodeRef.current)
      return;

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNodeRef.current);

    const volume = cookies.audioMuted ? 0 : (cookies.audioVolume ?? 0.2);
    gainNodeRef.current.gain.setValueAtTime(volume, ctx.currentTime);

    source.start(0);
  }, [cookies.audioMuted, cookies.audioVolume]);

  const fadeOut = useCallback((duration: number = 1000) => {
    if (!audioRef.current)
      return;

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
    if (!audioRef.current)
      return;

    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = audioRef.current;
    const finalVolume = cookies.audioMuted ? 0 : (cookies.audioVolume ?? 0.2);
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
  }, [cookies.audioMuted, cookies.audioVolume]);

  useRoomControllerListener(controller, useCallback((msg: ServerMessage | null) => {
    if (!audioRef.current) {
      return false;
    }
    const audio = audioRef.current;

    // perform requested action
    if (msg?.type === "audio_control") {
      const setStartPosAndPlay = () => {
        let pos = controller.roundData.progressbarOffset;

        const startPosition = controller.config.audioStartPosition === 3
          ? controller.roundData.audioStartPos
          : controller.config.audioStartPosition;
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

        audio.play().catch((e) => {
          console.error("[Audio] Failed to start playback:", e);
        });
        console.debug("[Audio] playing");
        fadeIn();
        audio.onloadedmetadata = null;
      };

      switch (msg.action) {
        case "load": {
          console.debug("[Audio] load");
          const currentAudioURL = msg.audioURL;
          // avoid resetting src if it is already correct
          if (audio.src !== currentAudioURL)
            audio.src = currentAudioURL;
          audio.load();
          break;
        }
        case "play":
          console.debug("[Audio] play");
          audio.volume = 0;

          try {
            setStartPosAndPlay();
          } catch {
            audio.onloadedmetadata = setStartPosAndPlay;
          }
          break;
        case "pause":
          console.debug("[Audio] pause");
          fadeOut();
          setTimeout(() => audio.pause(), 1000);
          break;
      }
    } else if (msg?.type === "countdown") {
      const buffer = msg.countdown > 0 ? countdownRunningBufferRef.current : countdownDoneBufferRef.current;
      playBuffer(buffer);
    }

    return false;
  }, [controller.config.audioStartPosition, controller.config.timePerQuestion, controller.roundData.progressbarOffset, controller.roundData.audioStartPos, fadeIn, fadeOut, playBuffer]));

  useEffect(() => {
    const volume = cookies.audioMuted ? 0 : (cookies.audioVolume ?? 0.2);

    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [cookies.audioMuted, cookies.audioVolume]);

  const getVolumeIcon = () => {
    if (cookies.audioMuted)
      return "volume_off";
    if (cookies.audioVolume === 0)
      return "volume_mute";
    if (cookies.audioVolume! <= 0.5)
      return "volume_down";
    return "volume_up";
  };

  return (
    <>
      <audio ref={audioRef} preload="auto" />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCookie("audioMuted", !cookies.audioMuted)}
          className="flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity focus-visible:ring-2 focus-visible:ring-secondary rounded"
          aria-label={cookies.audioMuted ? "Unmute" : "Mute"}
        >
          <span className="material-icons text-default" aria-hidden="true">
            {getVolumeIcon()}
          </span>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={cookies.audioVolume}
          onChange={e => setCookie("audioVolume", Number.parseFloat(e.target.value))}
          className="w-25 align-middle"
          aria-label="Volume"
        />
      </div>
    </>
  );
}
