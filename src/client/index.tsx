import { createRoot } from "react-dom/client";
import { useState } from "react";
import { fetchPostCreateRoom } from "../RoomHTTPHelper";
import { Button } from "./components/Button";
import { ErrorLabel } from "./components/ErrorLabel";
import { TopBar } from "./components/TopBar";
import {CookieConsent} from "react-cookie-consent";


/**
 * Main application component for the landing page.
 * Displays the SongGuess title and a button to create a new room.
 */
function App() {
  const [error, setError] = useState<string|null>(null);

  /**
   * Handles room creation button click.
   * Creates a new room via API and redirects to the room page.
   */
  const buttonClick = async () => {
    const resp = await fetchPostCreateRoom("/parties/main/createRoom");

    if (!resp) {
      setError("Unknown server error");
      return;
    }

    if (resp.error !== "") {
      setError(resp.error);
      return;
    }

    window.location.href = `/room?id=${resp.roomID}`;
  };

  return (
    <div className="flex flex-col h-screen">
      <CookieConsent location="bottom" buttonText="I understand" overlay >
        This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
      </CookieConsent>

      <TopBar />
      <div className="flex items-center justify-center flex-1 p-4">
        <div className="m-auto justify-items-center text-center max-w-full">
          <ErrorLabel error={error} />
          <Button
          onClick={buttonClick}
          className="md:text-3xl lg:text-4xl py-2 px-4 md:py-3 md:px-6 lg:py-4 lg:px-8">
            Create Room
          </Button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);