import { type ResultMusicTrack } from "itunes-store-api";
import { createRoot } from "react-dom/client";
import { useState, useCallback, createContext, useContext } from "react";
import { RoomController, useRoomController, useRoomControllerListener } from "./RoomController";

const RoomContext = createContext<RoomController | null>(null);

function useRoom() {
  const controller = useContext(RoomContext);
  if (!controller) throw new Error("useRoom must be used within RoomProvider");
  return controller;
}

function Audio({trackName, url}: {trackName: string, url: string}) {
  return (
    <div className="mb-4">
      <div className="font-semibold">{trackName}:</div>
      <audio controls className="mt-1">
        <source src={url} type="audio/aac"/>
      </audio>
    </div>
  );
}

function SearchBar() {
  const controller = useRoom();
  const [searchText, setSearchText] = useState(controller.searchText);
  const listener = useCallback((c: RoomController) => setSearchText(c.searchText), []);
  useRoomControllerListener(controller, listener);
 
  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
      <br/><br/>
      <input 
        placeholder="Enter apple music URL" 
        className="w-full outline-0 focus:outline-0 border-b-2 border-b-gray-400  focus:border-b-cyan-600 pb-1" 
        value={searchText} 
        onChange={e => {setSearchText(e.target.value); controller.searchText = e.target.value;}} 
        onKeyDown={e => {if (e.key === "Enter") controller.performSearch(searchText);}}
      />
      <br/><br/>
    </>
  );
}

function ResultsList() {
  const controller = useRoom();
  const [results, setResults] = useState<ResultMusicTrack[] | undefined>(controller.results);
  const [searchText, setSearchText] = useState(controller.searchText);
 
  const listener = useCallback((c: RoomController) => {
    setResults(c.results);
    setSearchText(c.searchText);
  }, []);
  useRoomControllerListener(controller, listener);
 
  if (!results || !Array.isArray(results)) return null;

  return (
    <div className="mb-6">
      <div className="mb-4">Songs for "{searchText}" ({results.length}):</div>
      
      {results
        .filter(result => result.trackName && result.previewUrl)
        .map(result => (
          <Audio
            key={result.previewUrl}
            trackName={result.trackName}
            url={result.previewUrl}
          />
        ))
      }
    </div>
  );
}

function App() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const { getController, isReady } = useRoomController(roomID);

  if (!isReady) return null;

  const controller = getController();

  return (
    <RoomContext.Provider value={controller}>
      <div className="max-w-3/4 mx-auto">
        <SearchBar />
        <ResultsList />
      </div>
    </RoomContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
