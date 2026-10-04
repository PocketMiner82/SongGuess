import { CookieConsent } from "react-cookie-consent";
import { Button } from "../../components/Button";
import { TopBar } from "../../components/TopBar";
import { showConfirm } from "../../modal/DialogOpeners";
import { useControllerContext } from "../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../hooks/RoomControllerListenerHooks";
import { PING_INTERVAL } from "../RoomController";
import { AudioComponent } from "./audio/AudioComponent";
import { BottomBar } from "./BottomBar";
import { ChooseUsernameScreen } from "./ChooseUsernameScreen";
import { Countdown } from "./Countdown";
import { IngameDisplay } from "./ingame/IngameDisplay";
import { QuestionHeader } from "./ingame/QuestionHeader";
import { LobbyDisplay } from "./lobby/LobbyDisplay";
import { PlayerList } from "./PlayerList";
import { ResultsDisplay } from "./results/ResultsDisplay";


export function RoomDisplay({ hasJoined, setHasJoined }: { hasJoined: boolean; setHasJoined: (val: boolean) => void }) {
  const controller = useControllerContext();

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

      {
        !hasJoined
          ? (
              <ChooseUsernameScreen onChoose={() => setHasJoined(true)} />
            )
          : (
              <>
                <div className="flex flex-1 flex-col-reverse lg:flex-row-reverse overflow-auto">
                  <main className="flex-1 flex flex-col lg:min-h-full lg:overflow-auto">
                    <QuestionHeader />
                    <div className="p-4 flex-1">
                      <LobbyDisplay />
                      <IngameDisplay />
                      <ResultsDisplay />
                    </div>
                  </main>
                  <aside className="p-4 border-border border-b lg:basis-sm lg:border-b-0 lg:border-r lg:overflow-auto">
                    <PlayerList />
                  </aside>
                </div>
                <Countdown />
              </>
            )
      }

      <BottomBar>
        <div className="flex-1 flex justify-start">
          {hasJoined && <AudioComponent />}
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
              {controller.currentPingMs >= PING_INTERVAL ? "999+" : controller.currentPingMs}
              {" "}
              ms
            </span>
          </div>
        )}
      </BottomBar>
    </div>
  );
}
