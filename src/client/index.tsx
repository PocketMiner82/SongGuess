import { createRoot } from "react-dom/client";
import { useState } from "react";
import { fetchPostCreateRoom } from "../RoomHTTPHelper";


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
    <div className="m-auto justify-items-center text-center max-w-full">
      <div className="text-6xl md:text-8xl lg:text-9xl font-extrabold mb-8 md:mb-16 lg:mb-24">SongGuess</div>
      
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
      className="bg-blue-500 hover:bg-blue-700 text-white font-bold text-2xl md:text-3xl lg:text-4xl py-2 px-4 md:py-3 md:px-6 lg:py-4 lg:px-8 rounded cursor-pointer"
      onClick={buttonClick}>Create Room</button>
      
    </div>
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);