import type { ICookieProps } from "../types/ICookieProps";
import { useState } from "react";
import { CookiesProvider, useCookies } from "react-cookie";
import { createRoot } from "react-dom/client";
import { ModalContainer } from "react-modal-global";
import { ConnectingScreen } from "./components/ConnectingScreen";
import { RoomDisplay } from "./components/RoomDisplay";
import { ToastDisplay } from "./components/ToastDisplay";
import { AudioPlayerContext } from "./hooks/audio/AudioPlayerContext";
import { useAudioPlayer } from "./hooks/audio/AudioPlayerHook";
import { RoomContext, useRoomController } from "./hooks/RoomControllerHooks";
import { Modal } from "./Modal";

/**
 * Main application component for the game room.
 * Manages room initialization, routing between game states, and global room providers.
 */
export function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [cookies, setCookie] = useCookies<
    "userID" | "userName" | "audioVolume" | "audioMuted",
    ICookieProps
  >(["userID", "userName", "audioVolume", "audioMuted"]);
  const { getController, isReady } = useRoomController(window.location.host, roomID, () => cookies, setCookie);

  const [hasJoined, setHasJoined] = useState(false);

  // Single shared preview player for the whole room. Providing it via context
  // lets any component (including modals rendered through a portal) read the
  // live, reactive playback state exactly as if useAudioPlayer were called
  // directly in that component.
  const player = useAudioPlayer(cookies.audioVolume ?? 0.2, cookies.audioMuted ?? false);

  const controller = getController();

  if (!controller) {
    return <ConnectingScreen roomID={roomID} />;
  }

  return (
    <RoomContext value={controller}>
      <AudioPlayerContext value={{ player, state: player.state }}>
        {
          isReady
            ? <RoomDisplay hasJoined={hasJoined} setHasJoined={setHasJoined} />
            : <ConnectingScreen roomID={roomID} />
        }

        <ToastDisplay />
        <ModalContainer controller={Modal} />
      </AudioPlayerContext>
    </RoomContext>
  );
}

createRoot(document.getElementById("app")!).render(
  <CookiesProvider defaultSetOptions={{
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  }}
  >
    <App />
  </CookiesProvider>,
);
