import { createRoot } from "react-dom/client";
import { useState, useCallback } from "react";
import {
  RoomContext, useControllerContext, useRoomController, useRoomControllerListener,
  useRoomControllerMessageTypeListener
} from "./room/RoomController";
import { Lobby } from "./room/components/Lobby";
import {Ingame} from "./room/components/Ingame";
import {Results} from "./room/components/Results";
import { BottomBar } from "./room/components/BottomBar";
import { TopBar } from "./components/TopBar";
import { Button } from "./components/Button";
import { Audio } from "./room/components/Audio";
import { ToastError } from "./components/ToastError";
import { FatalErrorPopup } from "./components/FatalErrorPopup";
import {CookieConsent} from "react-cookie-consent";
import {CookiesProvider, useCookies} from "react-cookie";
import type ICookieProps from "../types/ICookieProps";
import type {ServerMessage} from "../types/MessageTypes";


/**
 * Loading component displayed while the room controller is initializing.
 */
function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="text-2xl">Loading...</div>
    </div>
  );
}

/**
 * Countdown overlay component that displays a countdown number centered on screen.
 * Listens for countdown messages from the server and shows/hides accordingly.
 */
function Countdown() {
  const [countdown, setCountdown] = useState(0);
  const visible = countdown > 0;

  useRoomControllerListener(useControllerContext(), useCallback((msg: ServerMessage|null) => {
    if (msg && msg.type === "countdown") {
      setCountdown(msg.countdown);
    }
    return false;
  }, []));

  return visible ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85">
      <div className="text-white text-9xl font-bold">{countdown}</div>
    </div>
  ) : null;
}

function Room() {
  const controller = useControllerContext();
  const [hasJoined, setHasJoined] = useState(false);
  
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "pong");

  useRoomControllerListener(controller, useCallback((msg: ServerMessage|null) => {
    if (msg?.type === "update" && msg.state !== "ingame") {
      // only require button press if game is already running
      setHasJoined(true);
    }
    return false;
  }, []));

  return (
      <div className="flex flex-col h-screen">
        <CookieConsent location="bottom" buttonText="I understand" overlay >
          This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
        </CookieConsent>

        {hasJoined && <FatalErrorPopup/>}

        <TopBar>
          {controller.isHost && controller.state === "ingame" && (
              <Button onClick={() => {
                const isConfirmed = window.confirm(
                    "Do you really want to abort and send all players to the results screen?"
                );
                if (!isConfirmed) return;

                controller.returnTo("results")
              }}>
                Abort
              </Button>
          )}
        </TopBar>

        {
          !hasJoined ? (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-8">Game is running...</h1>
                  <Button onClick={() => {
                    setHasJoined(true);
                    controller.reconnect();
                  }}>
                    Join Game
                  </Button>
                </div>
              </div>
          ) : (
              <>
                <ToastError />

                <main className="flex-1 overflow-auto">
                  <Lobby />
                  <Ingame />
                  <Results />
                  <Countdown />
                </main>
              </>
          )
        }

        <BottomBar>
          <div className="flex-1 flex justify-start">
            <Audio />
          </div>
          {controller.currentPingMs >= 0 && (
              <div className="flex-1 flex justify-end">
                <span>Ping:</span>
                <span className={`ml-1 min-w-12 text-right ${
                    controller.currentPingMs > 250 ? "text-error" :
                    controller.currentPingMs > 100 ? "text-yellow-500" :
                    "text-success"
                }`}>{controller.currentPingMs} ms</span>
              </div>
          )}
        </BottomBar>
      </div>
  );
}

/**
 * Main application component for the game room.
 * Manages room initialization, routing between game states, and global room providers.
 */
function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [cookies, setCookie] = useCookies<"userID"|"userName", ICookieProps>(["userID", "userName"]);
  const { getController, isReady } = useRoomController(roomID, () => cookies, setCookie);

  if (!isReady) return <Loading />;

  const controller = getController();

  return (
      <RoomContext.Provider value={controller}>
        <Room />
      </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(
    <CookiesProvider defaultSetOptions={{
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    }}>
      <App />
    </CookiesProvider>
);
