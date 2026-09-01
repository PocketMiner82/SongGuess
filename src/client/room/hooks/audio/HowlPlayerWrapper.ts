import type { PlayerWrapper } from "./PlayerWrapper";
import { Howl } from "howler";


export const HOWL_SUPPORTED_FORMATS: string[] = ["mp3", "aac", "m4a", "ogg", "opus", "wav", "flac"];

export class HowlPlayerWrapper extends Howl implements PlayerWrapper {
  constructor(src: string, vol: number, mut: boolean, setState: (s: "loading" | "playing" | "not_playing") => void) {
    console.debug("[Howl] Creating Howl player for:", src);
    super({
      src: [src],
      format: HOWL_SUPPORTED_FORMATS,
      volume: vol,
      mute: mut,
      preload: true,
      onload: () => {
        console.debug("[Howl] onload");
        setState("loading");
      },
      onplay: () => {
        console.debug("[Howl] onplay");
        setState("playing");
      },
      onloaderror: (id, err) => {
        console.error("[Howl] onloaderror:", id, err);
        setState("not_playing");
      },
      onpause: () => {
        console.debug("[Howl] onpause");
        setState("not_playing");
      },
      onend: () => {
        console.debug("[Howl] onend");
        setState("not_playing");
      },
      onstop: () => {
        console.debug("[Howl] onstop");
        setState("not_playing");
      },
      onplayerror: (id, err) => {
        console.error("[Howl] onplayerror:", id, err);
        setState("not_playing");
      },
    });
  }
}
