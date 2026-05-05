import type ICookieProps from "../types/ICookieProps";
import type { ServerMessage } from "../types/MessageTypes";
import { useCallback, useEffect, useState } from "react";
import { CookiesProvider, useCookies } from "react-cookie";
import { CookieConsent } from "react-cookie-consent";
import { createRoot } from "react-dom/client";
import { ModalContainer } from "react-modal-global";
import { Button } from "./components/Button";
import { ToastDisplay } from "./components/ToastDisplay";
import { TopBar } from "./components/TopBar";
import { ChooseUsernameDialog } from "./modal/ChooseUsernameDialog";
import { showConfirm } from "./modal/DialogOpeners";
import { Modal } from "./modal/Modal";
import { Audio } from "./room/audio/Audio";
import { BottomBar } from "./room/components/BottomBar";
import { Ingame } from "./room/components/ingame/Ingame";
import { QuestionHeader } from "./room/components/ingame/QuestionHeader";
import { Lobby } from "./room/components/lobby/Lobby";
import { Results } from "./room/components/Results";
import {
  RoomContext,
  useControllerContext,
  useRoomController,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "./room/RoomController";

/**
 * Loading component displayed while the room controller is initializing.
 */
function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="text-2xl">Loading…</div>
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

  useRoomControllerListener(useControllerContext(), useCallback((msg: ServerMessage | null) => {
    if (msg && msg.type === "countdown") {
      setCountdown(msg.countdown);
    }
    return false;
  }, []));

  return visible
    ? (
        <div className="fixed inset-0 flex items-center justify-center bg-black/85" aria-live="polite">
          <div className="text-white text-9xl font-bold">{countdown}</div>
        </div>
      )
    : null;
}

/**
 * Screen component displayed when a user needs to choose a username before joining the room.
 * Shows the room ID and provides an input field for username selection.
 *
 * @param onChoose - Callback function called after the user successfully chooses a username
 * @constructor
 */
function ChooseUsernameScreen({ onChoose }: { onChoose: () => void }) {
  useEffect(() => {
    Modal.open(ChooseUsernameDialog, { onComplete: onChoose, closable: false });
  }, [onChoose]);

  return <div className="h-full w-full"></div>;
}

function Room() {
  const controller = useControllerContext();
  const [hasJoined, setHasJoined] = useState(false);

  useRoomControllerMessageTypeListener(controller, "room_state");
  useRoomControllerMessageTypeListener(controller, "pong");

  return (
    <div className="flex flex-col h-screen">
      <CookieConsent location="bottom" buttonText="I understand" overlay>
        This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
      </CookieConsent>

      <TopBar>
        {controller.isHost && controller.state === "ingame" && (
          <Button onClick={async () => {
            const isConfirmed = await showConfirm(
              "Abort Game",
              "Do you really want to abort and send all players to the results screen?",
            );
            if (!isConfirmed)
              return;

            controller.returnTo("results");
          }}
          >
            Abort
          </Button>
        )}
      </TopBar>

      <QuestionHeader />

      {
        !hasJoined
          ? (
              <ChooseUsernameScreen onChoose={() => setHasJoined(true)} />
            )
          : (
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
              controller.currentPingMs > 250
                ? "text-error"
                : controller.currentPingMs > 100
                  ? "text-yellow-500"
                  : "text-success"
            }`}
            >
              {controller.currentPingMs}
              {" "}
              ms
            </span>
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
export function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [cookies, setCookie] = useCookies<"userID" | "userName", ICookieProps>(["userID", "userName"]);
  const { getController, isReady } = useRoomController(roomID, () => cookies, setCookie);

  if (!isReady)
    return <Loading />;

  const controller = getController();

  return (
    <RoomContext value={controller}>
      <Room />
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
