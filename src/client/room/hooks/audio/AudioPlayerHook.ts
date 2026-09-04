import type { Howl } from "howler";
import type { PlayerWrapper } from "./PlayerWrapper";
import { useCallback, useEffect, useRef, useState } from "react";
import { HLSPlayerWrapper } from "./HLSPlayerWrapper";
import { HowlPlayerWrapper } from "./HowlPlayerWrapper";


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

function isHLSContentType(contentType: string | null): boolean {
  if (!contentType)
    return false;
  const lower = contentType.toLowerCase();
  return lower.includes("mpegurl") || lower.includes("m3u8");
}

async function detectIsHLS(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    const contentType = response.headers.get("content-type");
    return isHLSContentType(contentType);
  } catch { }

  try {
    const response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
    const contentType = response.headers.get("content-type");
    return isHLSContentType(contentType);
  } catch (e) {
    console.warn(`[Audio] HLS detection failed - both HEAD and GET requests to ${url} failed:`, e);
  }
  return false;
}

function isLocalFile(url: string): boolean {
  return (url.startsWith("/") && !url.startsWith("/api/"))
    || url.startsWith("./")
    || url.startsWith("../")
    || url.endsWith(".mp3");
}

export function useAudioPlayer(volume: number, muted: boolean, url?: string): AudioPlayer {
  const [state, setState] = useState<"loading" | "playing" | "not_playing">("not_playing");
  const [audioURL, setAudioURL] = useState<string | undefined>(url);
  const [isHLS, setIsHLS] = useState<boolean>(false);

  const playerRef = useRef<PlayerWrapper | null>(null);
  const initializingRef = useRef<Promise<void> | null>(null);

  const createPlayer = async (src: string, vol: number, mut: boolean): Promise<PlayerWrapper> => {
    if (isLocalFile(src)) {
      setIsHLS(false);
      return new HowlPlayerWrapper(src, vol, mut, setState);
    }

    const hls = await detectIsHLS(src);
    console.debug(`[Audio] HLS detection result for ${src}:`, hls);
    setIsHLS(hls);

    if (hls) {
      return new HLSPlayerWrapper(src, vol, mut);
    } else {
      return new HowlPlayerWrapper(src, vol, mut, setState);
    }
  };

  const initializePlayer = useCallback(async (src: string): Promise<void> => {
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

    playerRef.current = await createPlayer(src, volume, muted);

    playerRef.current.on("load", async () => {
      setState("loading");
    });
    playerRef.current.on("play", async () => {
      setState("playing");
    });
    playerRef.current.on("loaderror", async () => {
      setState("not_playing");
    });
    playerRef.current.on("pause", async () => {
      setState("not_playing");
    });
    playerRef.current.on("end", async () => {
      setState("not_playing");
    });
    playerRef.current.on("stop", async () => {
      setState("not_playing");
    });
    playerRef.current.on("playerror", async () => {
      setState("not_playing");
    });
  }, [muted, volume]);

  const ensurePlayerReady = async (): Promise<PlayerWrapper | null> => {
    if (initializingRef.current) {
      await initializingRef.current;
    }
    return playerRef.current;
  };

  useEffect(() => {
    if (url && !playerRef.current) {
      initializePlayer(url).then();
    }
  }, [initializePlayer, url]);

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

  const load = async (src: string): Promise<void> => {
    if (audioURL !== src) {
      const initPromise = initializePlayer(src);
      initializingRef.current = initPromise;
      await initPromise;
      initializingRef.current = null;
    }
  };

  const playWithFade = async (fadeDuration: number = 1000) => {
    const player = await ensurePlayerReady();
    if (!player) {
      console.error("[Audio] Cannot play audio before loading.");
      return;
    }

    player.stop();
    player.once("play", () => {
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
