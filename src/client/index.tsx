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
        <span className="material-icons mr-1">error</span>
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