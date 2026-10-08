export interface PlayerWrapper {
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
