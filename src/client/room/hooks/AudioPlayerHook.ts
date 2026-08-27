import Hls from "hls.js";
import { Howl } from "howler";
import { useEffect, useRef, useState } from "react";


export interface AudioPlayer {
  audioURL: string | undefined;
  state: "loading" | "playing" | "not_playing";
  howler: Howl | null;
  isHLS: boolean;
  load: (src: string) => Promise<void>;
  playWithPositionAndFade: (startPosition: number, audioPlayTime: number, startOffset?: number, fadeDuration?: number) => void;
  playWithFade: (fadeDuration?: number) => void;
  pauseWithFade: (fadeDuration?: number) => void;
}

interface PlayerLike {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (position: number) => void;
  volume: (vol?: number) => number;
  mute: (muted?: boolean) => boolean;
  duration: () => number;
  on: (event: string, callback: () => void) => void;
  off: (event: string, callback?: () => void) => void;
  once: (event: string, callback: () => void) => void;
  unload: () => void;
  fade: (from: number, to: number, duration: number) => void;
  state: () => string;
}

class HLSPlayerWrapper implements PlayerLike {
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
      this.emit("play");
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

function isHLSContentType(contentType: string | null): boolean {
  if (!contentType)
    return false;
  const lower = contentType.toLowerCase();
  return lower.includes("mpegurl") || lower.includes("m3u8");
}

async function detectIsHLS(url: string): Promise<boolean> {
  console.debug("[Audio] Detecting HLS for:", url);
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentType = response.headers.get("content-type");
    console.debug("[Audio] HEAD response content-type:", contentType);
    if (isHLSContentType(contentType)) {
      console.debug("[Audio] Detected HLS via HEAD");
      return true;
    }
  } catch (e) {
    console.debug("[Audio] HEAD request failed:", e);
  }
  try {
    const response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
    const contentType = response.headers.get("content-type");
    console.debug("[Audio] GET response content-type:", contentType);
    if (isHLSContentType(contentType)) {
      console.debug("[Audio] Detected HLS via GET");
      return true;
    }
  } catch (e) {
    console.debug("[Audio] GET request failed:", e);
  }
  console.debug("[Audio] Not HLS");
  return false;
}

function isLocalFile(url: string): boolean {
  return (url.startsWith("/") && !url.startsWith("/api/")) || url.startsWith("./") || url.startsWith("../") || url.endsWith(".mp3");
}

const SUPPORTED_FORMATS: string[] = ["mp3", "aac", "m4a", "ogg", "opus", "wav", "flac"];

function createHowlPlayer(src: string, vol: number, mut: boolean, setState: (s: "loading" | "playing" | "not_playing") => void): PlayerLike {
  console.debug("[Howl] Creating Howl player for:", src);
  return new Howl({
    src: [src],
    format: SUPPORTED_FORMATS,
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
  }) as unknown as PlayerLike;
}

export function useAudioPlayer(volume: number, muted: boolean, url?: string): AudioPlayer {
  const [state, setState] = useState<"loading" | "playing" | "not_playing">("not_playing");
  const [audioURL, setAudioURL] = useState<string | undefined>(url);
  const [isHLS, setIsHLS] = useState<boolean>(false);

  const playerRef = useRef<PlayerLike | null>(null);
  const initializingRef = useRef<Promise<void> | null>(null);

  const createPlayer = async (src: string, vol: number, mut: boolean): Promise<PlayerLike> => {
    console.debug("[Audio] createPlayer called for:", src);
    if (isLocalFile(src)) {
      console.debug("[Audio] Local file, using Howl");
      setIsHLS(false);
      return createHowlPlayer(src, vol, mut, setState);
    }

    console.debug("[Audio] Remote file, detecting HLS");
    const hls = await detectIsHLS(src);
    console.debug("[Audio] HLS detection result:", hls);
    setIsHLS(hls);

    if (hls) {
      console.debug("[Audio] Creating HLSPlayerWrapper");
      return new HLSPlayerWrapper(src, vol, mut);
    } else {
      console.debug("[Audio] Creating Howl player");
      return createHowlPlayer(src, vol, mut, setState);
    }
  };

  const initializePlayer = async (src: string): Promise<void> => {
    console.debug("[Audio] initializePlayer:", src);
    if (playerRef.current) {
      const player = playerRef.current;
      player.off("load");
      player.off("play");
      player.off("loaderror");
      player.off("pause");
      player.off("end");
      player.off("stop");
      player.off("playerror");
      player.off("fade");
      player.unload();
      player.stop();
    }

    setState("loading");
    setAudioURL(src);

    if (isLocalFile(src)) {
      playerRef.current = createHowlPlayer(src, volume, muted, setState);
      setIsHLS(false);
    } else {
      playerRef.current = await createPlayer(src, volume, muted);
    }

    console.debug("[Audio] Player created, type:", playerRef.current.constructor.name);

    playerRef.current.on("load", () => {
      console.debug("[Audio] Player load event");
      setState("loading");
    });
    playerRef.current.on("play", () => {
      console.debug("[Audio] Player play event");
      setState("playing");
    });
    playerRef.current.on("loaderror", () => {
      console.debug("[Audio] Player loaderror event");
      setState("not_playing");
    });
    playerRef.current.on("pause", () => {
      console.debug("[Audio] Player pause event");
      setState("not_playing");
    });
    playerRef.current.on("end", () => {
      console.debug("[Audio] Player end event");
      setState("not_playing");
    });
    playerRef.current.on("stop", () => {
      console.debug("[Audio] Player stop event");
      setState("not_playing");
    });
    playerRef.current.on("playerror", () => {
      console.debug("[Audio] Player playerror event");
      setState("not_playing");
    });
  };

  const load = async (src: string): Promise<void> => {
    console.debug("[Audio] load() called:", src);
    if (audioURL !== src) {
      const initPromise = initializePlayer(src);
      initializingRef.current = initPromise;
      await initPromise;
      initializingRef.current = null;
      console.debug("[Audio] load() completed");
    }
  };

  const ensurePlayerReady = async (): Promise<PlayerLike | null> => {
    if (initializingRef.current) {
      await initializingRef.current;
    }
    return playerRef.current;
  };

  if (url && !playerRef.current) {
    initializePlayer(url).then();
  }

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }
    const player = playerRef.current;
    player.mute(muted);
  }, [muted]);

  useEffect(() => {
    if (!playerRef.current) {
      return;
    }
    const player = playerRef.current;
    player.volume(volume);
  }, [volume]);

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      playerRef.current?.unload();
    };
  }, []);

  const playWithFade = async (fadeDuration: number = 1000) => {
    console.debug("[Audio] playWithFade() called");
    const player = await ensurePlayerReady();
    if (!player) {
      console.error("[Audio] Cannot play audio before loading.");
      return;
    }
    console.debug("[Audio] Player ready, stopping and playing");
    player.stop();
    player.once("play", () => {
      console.debug("[Audio] Player play event in playWithFade, starting fade");
      player.fade(0, volume, fadeDuration);
    });
    player.volume(0);
    player.play();
  };

  const playWithPositionAndFade = async (
    startPosition: number,
    audioPlayTime: number,
    startOffset: number = 0,
    fadeDuration: number = 1000,
  ) => {
    const player = await ensurePlayerReady();
    if (!player) {
      console.error("[Audio] Cannot play audio before loading.");
      return;
    }

    await playWithFade(fadeDuration);

    player.once("play", () => {
      const duration = player.duration() - 0.5;

      if (startPosition !== null && startPosition > 0) {
        startOffset += Math.max(0, (duration - audioPlayTime) * startPosition);
      }

      player.seek(startOffset);
    });
  };

  const pauseWithFade = async (fadeDuration: number = 1000) => {
    const player = await ensurePlayerReady();
    if (!player) {
      console.error("[Audio] Cannot pause audio before loading.");
      return;
    }

    player.fade(player.volume(), 0, fadeDuration);
    player.once("fade", () => {
      player.pause();
      player.volume(volume);
    });
  };

  return {
    audioURL,
    state,
    howler: playerRef.current as Howl | null,
    isHLS,
    load,
    playWithPositionAndFade,
    playWithFade,
    pauseWithFade,
  };
}
