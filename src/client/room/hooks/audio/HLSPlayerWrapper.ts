import type { PlayerWrapper } from "./PlayerWrapper";
import Hls from "hls.js";


export class HLSPlayerWrapper implements PlayerWrapper {
  private readonly audio: HTMLAudioElement;
  private hls: Hls;
  private volumeValue: number = 1;
  private mutedValue: boolean = false;
  private eventListeners: Map<string, Set<() => void>> = new Map();
  private isPlaying: boolean = false;
  private fadeTimeout: number | null = null;
  private fadeStartVolume: number = 0;
  private fadeTargetVolume: number = 0;
  private fadeDuration: number = 0;
  private fadeStartTime: number = 0;

  constructor(_src: string, volume: number, muted: boolean) {
    this.volumeValue = volume;
    this.mutedValue = muted;
    console.debug("[HLS] Creating HLSPlayerWrapper for:", _src);

    this.audio = document.createElement("audio");
    this.audio.crossOrigin = "anonymous";
    this.audio.preload = "auto";

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });

    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      console.debug("[HLS] MEDIA_ATTACHED");
    });

    this.hls.on(Hls.Events.MANIFEST_LOADING, () => {
      console.debug("[HLS] MANIFEST_LOADING");
      this.emit("load");
    });

    this.hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      console.debug("[HLS] MANIFEST_PARSED:", data);
    });

    this.hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
      console.debug("[HLS] LEVEL_LOADED:", data);
    });

    this.hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      console.debug("[HLS] FRAG_LOADED:", data);
    });

    this.hls.on(Hls.Events.ERROR, (_event, data) => {
      console.error("[HLS] ERROR:", data);
      if (data.fatal) {
        this.emit("loaderror");
        this.emit("playerror");
      }
    });

    this.hls.loadSource(_src);
    this.hls.attachMedia(this.audio);

    this.audio.volume = this.mutedValue ? 0 : this.volumeValue;
    this.audio.muted = this.mutedValue;

    this.audio.addEventListener("play", () => {
      console.debug("[HLS] audio play event");
      this.isPlaying = true;
    });

    this.audio.addEventListener("pause", () => {
      console.debug("[HLS] audio pause event");
      this.isPlaying = false;
      this.emit("pause");
    });

    this.audio.addEventListener("ended", () => {
      console.debug("[HLS] audio ended event");
      this.isPlaying = false;
      this.emit("end");
    });

    this.audio.addEventListener("error", (e) => {
      console.error("[HLS] audio error event:", e);
      this.emit("loaderror");
      this.emit("playerror");
    });

    this.audio.addEventListener("waiting", () => {
      console.debug("[HLS] audio waiting event");
    });

    this.audio.addEventListener("canplay", () => {
      console.debug("[HLS] audio canplay event");
      if (this.isPlaying) {
        this.emit("play");
      }
    });

    this.audio.addEventListener("loadeddata", () => {
      console.debug("[HLS] audio loadeddata event");
    });
  }

  private emit(event: string) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(cb => cb());
    }
  }

  play() {
    console.debug("[HLS] play() called");
    this.audio.play().catch((e) => {
      console.error("[HLS] play() failed:", e);
      this.emit("playerror");
    });
  }

  pause() {
    console.debug("[HLS] pause() called");
    this.audio.pause();
  }

  stop() {
    console.debug("[HLS] stop() called");
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.emit("stop");
  }

  seek(position: number) {
    this.audio.currentTime = position;
  }

  volume(vol?: number): number {
    if (vol !== undefined) {
      this.volumeValue = vol;
      this.audio.volume = this.mutedValue ? 0 : vol;
    }
    return this.audio.volume;
  }

  mute(muted?: boolean): boolean {
    if (muted !== undefined) {
      this.mutedValue = muted;
      this.audio.muted = muted;
      this.audio.volume = muted ? 0 : this.volumeValue;
    }
    return this.audio.muted;
  }

  duration(): number {
    return this.audio.duration || 0;
  }

  on(event: string, callback: () => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback?: () => void) {
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
    } else {
      this.eventListeners.get(event)?.clear();
    }
  }

  once(event: string, callback: () => void) {
    const wrapper = () => {
      callback();
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  unload() {
    this.hls.destroy();
    this.audio.src = "";
    this.audio.load();
    this.eventListeners.clear();
  }

  fade(from: number, to: number, duration: number) {
    if (this.fadeTimeout) {
      cancelAnimationFrame(this.fadeTimeout);
    }

    this.fadeStartVolume = from;
    this.fadeTargetVolume = to;
    this.fadeDuration = duration;
    this.fadeStartTime = Date.now();

    this.audio.volume = this.mutedValue ? 0 : from;

    const animateFade = () => {
      const elapsed = Date.now() - this.fadeStartTime;
      const progress = Math.min(elapsed / this.fadeDuration, 1);
      const currentVolume = this.fadeStartVolume + (this.fadeTargetVolume - this.fadeStartVolume) * progress;

      this.audio.volume = this.mutedValue ? 0 : currentVolume;

      if (progress < 1) {
        this.fadeTimeout = requestAnimationFrame(animateFade);
      } else {
        this.emit("fade");
      }
    };

    this.fadeTimeout = requestAnimationFrame(animateFade);
  }

  state(): string {
    if (this.isPlaying)
      return "playing";
    return "not_playing";
  }
}
