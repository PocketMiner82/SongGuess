import { useState } from "react";
import { CookieConsent } from "react-cookie-consent";
import { createRoot } from "react-dom/client";
import { ModalContainer } from "react-modal-global";
import { toast } from "react-toastify";
import { Button } from "./components/Button";
import { ToastDisplay } from "./components/ToastDisplay";
import { TopBar } from "./components/TopBar";
import { Modal } from "./Modal";
import { fetchPostCreateRoom } from "./util/HTTPHelpers";


/**
 * Main application component for the landing page.
 * Displays the SongGuess title and a button to create a new room.
 */
export function App() {
  const [roomCreationRunning, setRoomCreationRunning] = useState(false);

  /**
   * Handles room creation button click.
   * Creates a new room via API and redirects to room page.
   */
  const buttonClick = async () => {
    setRoomCreationRunning(true);
    const resp = await fetchPostCreateRoom("/api/createRoom");
    setRoomCreationRunning(false);

    if (!resp) {
      toast.error("Creating room failed. See console for details.");
      return;
    }

    if (resp.error !== "") {
      toast.error(resp.error);
      return;
    }

    window.location.href = `/room?id=${resp.roomID}`;
  };

  return (
    <div className="flex flex-col h-screen">
      <CookieConsent location="bottom" buttonText="I understand" overlay>
        This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
      </CookieConsent>

      <TopBar />

      <div className="flex items-center justify-center flex-1 p-4">
        <div className="m-auto justify-items-center text-center max-w-full">
          <Button
            onClick={() => window.location.href = "/transferPlaylist"}
            className="mb-4"
          >
            Transfer Playlist
          </Button>

          <div>
            <Button
              onClick={buttonClick}
              className="text-3xl! py-3 px-6"
            >
              {roomCreationRunning && (
                <span className="material-symbols-outlined animate-spin text-white mr-4" role="img" aria-label="Loading">
                  progress_activity
                </span>
              )}
              Create Room
            </Button>
          </div>

        </div>
      </div>

      <ToastDisplay />

      <ModalContainer controller={Modal} />
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
