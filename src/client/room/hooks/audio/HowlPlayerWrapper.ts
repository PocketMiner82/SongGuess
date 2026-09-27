import type { PlayerWrapper } from "./PlayerWrapper";
import { Howl } from "howler";


export const HOWL_SUPPORTED_FORMATS: string[] = ["mp3", "aac", "m4a", "ogg", "opus", "wav", "flac"];

export class HowlPlayerWrapper extends Howl implements PlayerWrapper {
  constructor(src: string, vol: number, mut: boolean) {
    console.debug("[Audio] Creating HowlPlayerWrapper for:", src);
    super({
      src: [src],
      format: HOWL_SUPPORTED_FORMATS,
      volume: vol,
      mute: mut,
      preload: true,
    });
  }
}
