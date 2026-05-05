import type ICookieProps from "../../../types/ICookieProps";
import type { ServerMessage } from "../../../types/MessageTypes";
import { useCallback } from "react";
import { useCookies } from "react-cookie";
import { ROUND_PADDING_TICKS } from "../../../shared/ConfigConstants";
import { useControllerContext, useRoomControllerListener } from "../RoomController";
import { AudioControls } from "./AudioControls";
import { useAudioPlayer } from "./AudioPlayerHook";

/**
 * Audio component that handles audio playback and controls.
 * Manages audio element, volume control, and responds to server audio control messages.
 */
export function Audio() {
  const controller = useControllerContext();
  const [cookies, setCookie] = useCookies<"audioVolume" | "audioMuted", ICookieProps>(["audioVolume", "audioMuted"]);
  const audioVolume = cookies.audioVolume ?? 0.2;
  const audioMuted = cookies.audioMuted ?? false;

  const mainPlayer = useAudioPlayer(audioVolume, audioMuted);
  const countdownRunningPlayer = useAudioPlayer(audioVolume, audioMuted, "/sounds/countdown_running_1.mp3");
  const countdownDonePlayer = useAudioPlayer(audioVolume, audioMuted, "/sounds/countdown_done_1.mp3");

  useRoomControllerListener(controller, useCallback((msg: ServerMessage | null) => {
    if (!countdownRunningPlayer.howler || !countdownDonePlayer.howler) {
      return false;
    }

    // perform requested action
    if (msg?.type === "audio_control") {
      switch (msg.action) {
        case "load": {
          console.debug("[Audio] load");

          mainPlayer.load(msg.audioURL);
          break;
        }
        case "play": {
          console.debug("[Audio] play");

          const startPosition = controller.config.audioStartPosition === 3
            ? controller.questionData.audioStartPos
            : controller.config.audioStartPosition;

          mainPlayer.playWithPositionAndFade(
            startPosition,
            controller.config.timePerQuestion + ROUND_PADDING_TICKS,
            controller.questionData.progressbarOffset,
          );
          break;
        }
        case "pause":
          console.debug("[Audio] pause");

          mainPlayer.pauseWithFade();
          break;
      }
    } else if (msg?.type === "countdown") {
      const player: Howl = msg.countdown > 0 ? countdownRunningPlayer.howler : countdownDonePlayer.howler;

      player.seek(0);
      player.play();
    }

    return false;
  }, [
    countdownRunningPlayer.howler,
    countdownDonePlayer.howler,
    mainPlayer,
    controller.config.audioStartPosition,
    controller.config.timePerQuestion,
    controller.questionData.audioStartPos,
    controller.questionData.progressbarOffset,
  ]));

  return (
    <>
      <AudioControls
        muted={cookies.audioMuted ?? false}
        volume={cookies.audioVolume ?? 0.2}
        onMuteChange={() => setCookie("audioMuted", !cookies.audioMuted)}
        onVolumeChange={newVolume => setCookie("audioVolume", newVolume)}
      />
    </>
  );
}
