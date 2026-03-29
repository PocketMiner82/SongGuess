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
import {UsernameInputField} from "./room/components/UsernameInputField";


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

/**
 * Screen component displayed when a user needs to choose a username before joining the room.
 * Shows the room ID and provides an input field for username selection.
 *
 * @param onChoose - Callback function called after the user successfully chooses a username
 * @constructor
 */
function ChooseUsernameScreen({onChoose}: {onChoose: () => void}) {
  const controller = useControllerContext();

  return (
      <div className="flex items-center justify-center h-full w-full p-4">
        <div className="bg-card-bg rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
          <h2 className="text-xl font-bold text-default mb-6">Room {controller.roomID}</h2>
          <p className="text-default mb-2">Please choose your username:</p>

          <div className="mb-2">
            <UsernameInputField onEnd={(editedName) => {
              controller.reconnect(editedName);
              onChoose();
            }} requireEnter={true} showButton={true} />
          </div>

          <div className="mb-4 w-full">
            <Button className="w-full" onClick={() => {
              const nameInput = document.querySelector<HTMLInputElement>("#username-input");
              const name = nameInput?.value ?? "";
              controller.reconnect(name, true);
              onChoose();
            }}>
              Join as Spectator
            </Button>
          </div>

          <p className="text-sm text-disabled-text">Tip: You can later click on your username to change it.</p>
        </div>
      </div>
  );
}

function Room() {
  const controller = useControllerContext();
  const [hasJoined, setHasJoined] = useState(false);
  
  useRoomControllerMessageTypeListener(controller, "update");
  useRoomControllerMessageTypeListener(controller, "pong");

  return (
      <div className="flex flex-col h-screen">
        <CookieConsent location="bottom" buttonText="I understand" overlay >
          This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
        </CookieConsent>

        <FatalErrorPopup/>

        <TopBar>
          {controller.isHost && controller.state === "ingame" && (
              <Button onClick={() => {
                const isConfirmed = window.confirm(
                    "Do you really want to abort and send all players to the results screen?"
                );
                if (!isConfirmed) return;

                controller.returnTo("results");
              }}>
                Abort
              </Button>
          )}
        </TopBar>

        <ToastError />

        {
          !hasJoined ? (
              <ChooseUsernameScreen onChoose={() => setHasJoined(true)} />
          ) : (
              <>
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
            {hasJoined && <Audio />}
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
