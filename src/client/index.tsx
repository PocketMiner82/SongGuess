import { createRoot } from "react-dom/client";
import { useState } from "react";
import { fetchPostCreateRoom } from "../RoomHTTPHelper";
import { Button } from "./components/Button";
import { ErrorLabel } from "./components/ErrorLabel";


function App() {
  const [error, setError] = useState<string|null>(null);

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
    <>
    <div className="flex items-center justify-center h-screen">
      <div className="m-auto justify-items-center text-center max-w-full">
        <div className="text-6xl md:text-8xl lg:text-9xl font-extrabold mb-8 md:mb-16 lg:mb-24">
          SongGuess
        </div>
        
        <ErrorLabel error={error} />
        <Button
        onClick={buttonClick}
        className="md:text-3xl lg:text-4xl py-2 px-4 md:py-3 md:px-6 lg:py-4 lg:px-8">
          Create Room
        </Button>
      </div>
    </div>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);