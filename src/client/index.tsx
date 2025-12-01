import "./index.css";

import { createRoot } from "react-dom/client";
import { useState } from "react";
import { fetchPostCreateRoom } from "../RoomHTTPRequests";


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
    <div className="m-auto justify-items-center text-center">
      <div className="text-8xl font-extrabold mb-24">SongGuess</div>
      
      <div
      className={"flex items-center justify-center mb-2 text-sm text-red-800 rounded-lg dark:text-red-400 " + (error ? "visible" : "invisible")}
      role="alert">
        <svg
        className="shrink-0 inline w-4 h-4 me-3"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="currentColor"
        viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
        </svg>

        <span className="sr-only">Error</span>
        <div>
          <span className="font-medium">{error as string}</span>
        </div>
      </div>
      
      <button
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold text-3xl py-3 px-6 rounded cursor-pointer"
      onClick={buttonClick}>Create Room</button>
      
    </div>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);