import type { ICookieProps } from "../types/ICookieProps";
import { useState } from "react";
import { CookiesProvider, useCookies } from "react-cookie";
import { createRoot } from "react-dom/client";
import { ModalContainer } from "react-modal-global";
import { ToastDisplay } from "./components/ToastDisplay";
import { Modal } from "./modal/Modal";
import { ConnectingScreen } from "./room/components/ConnectingScreen";
import { RoomDisplay } from "./room/components/RoomDisplay";
import { RoomContext, useRoomController } from "./room/hooks/RoomControllerHooks";

/**
 * Main application component for the game room.
 * Manages room initialization, routing between game states, and global room providers.
 */
export function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [cookies, setCookie] = useCookies<"userID" | "userName", ICookieProps>(["userID", "userName"]);
  const { getController, isReady } = useRoomController(window.location.host, roomID, () => cookies, setCookie);

  const [hasJoined, setHasJoined] = useState(false);

  const controller = getController();

  if (!controller) {
    return <ConnectingScreen roomID={roomID} />;
  }

  return (
    <RoomContext value={controller}>
      {
        isReady
          ? <RoomDisplay hasJoined={hasJoined} setHasJoined={setHasJoined} />
          : <ConnectingScreen roomID={roomID} />
      }

      <ToastDisplay />
      <ModalContainer controller={Modal} />
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
