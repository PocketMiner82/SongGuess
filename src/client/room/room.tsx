import { createRoot } from "react-dom/client";
import { useState, useCallback } from "react";
import { RoomContext, useControllerContext, useRoomController, useRoomControllerListener, useIsHost, useGameState } from "./RoomController";
import type { ServerMessage } from "../../schemas/RoomMessageSchemas";
import { Lobby } from "./components/Lobby";
import {Ingame} from "./components/Ingame";
import {Results} from "./components/Results";
import { BottomBar } from "./components/BottomBar";
import { TopBar } from "../components/TopBar";
import { Button } from "../components/Button";
import { Audio } from "./components/Audio";


/**
 * Loading component displayed while the room controller is initializing.
 */
function Loading() {
  return (
    <div className="flex items-center justify-center h-full p-4">
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

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type !== "countdown") return;
    setCountdown(msg.countdown);
  }, []);

  useRoomControllerListener(useControllerContext(), listener);

  return visible ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85">
      <div className="text-white text-9xl font-bold">{countdown}</div>
    </div>
  ) : null;
}

function Room() {
  const controller = useControllerContext();
  const isHost = useIsHost(controller);
  const gameState = useGameState(controller);

  // if port is set, this is probably a dev environment: prevent accidental reloads
  if (!window.location.port) window.onbeforeunload = () => true;

  return (
      <RoomContext.Provider value={controller}>
        <div className="flex flex-col h-screen">
          <TopBar>
            {isHost && gameState === "ingame" && (
                <Button onClick={() => controller.returnToLobby()}>
                  End Game
                </Button>
            )}
          </TopBar>
          <main className="flex-1 overflow-auto">
            <Lobby />
            <Ingame />
            <Results />
            <Countdown />
          </main>
          <BottomBar>
            <Audio />
          </BottomBar>
        </div>
      </RoomContext.Provider>
  );
}

/**
 * Main application component for the game room.
 * Manages room initialization, routing between game states, and global room providers.
 */
function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const { getController, isReady } = useRoomController(roomID);

  if (!isReady) return <Loading />;

  const controller = getController();

  // if port is set, this is probably a dev environment: prevent accidental reloads
  if (!window.location.port) window.onbeforeunload = () => true;

  return (
    <RoomContext.Provider value={controller}>
      <Room />
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
