import type { PlayerWrapper } from "./PlayerWrapper";
import { Howl } from "howler";


export const HOWL_SUPPORTED_FORMATS: string[] = ["mp3", "aac", "m4a", "ogg", "opus", "wav", "flac"];

export class HowlPlayerWrapper extends Howl implements PlayerWrapper {
  constructor(src: string, vol: number, mut: boolean, setState: (s: "loading" | "playing" | "not_playing") => void) {
    console.debug("[Audio] Creating HowlPlayerWrapper for:", src);
    super({
      src: [src],
      format: HOWL_SUPPORTED_FORMATS,
      volume: vol,
      mute: mut,
      preload: true,
      onload: () => {
        setState("loading");
      },
      onplay: () => {
        setState("playing");
      },
      onloaderror: (id, err) => {
        console.error("[Audio] Howl: onloaderror:", id, err);
        setState("not_playing");
      },
      onpause: () => {
        setState("not_playing");
      },
      onend: () => {
        setState("not_playing");
      },
      onstop: () => {
        setState("not_playing");
      },
      onplayerror: (id, err) => {
        console.error("[Audio] Howl: onplayerror:", id, err);
        setState("not_playing");
      },
    });
  }
}
