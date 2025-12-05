import usePartySocket from "partysocket/react";
import { lookup, type ResultMusicTrack } from "itunes-store-api";
import { createRoot } from "react-dom/client";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { HostUpdatePlaylistMessage } from "../../messages/RoomClientMessages";
import { ServerMessageSchema } from "../../messages/RoomMessages";
import z from "zod";
import { useRoomController } from "./RoomController";

declare const PARTYKIT_HOST: string;

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

function SearchBar({searchText, onSearchTextChange, onEnter}: {searchText: string, onSearchTextChange: Dispatch<SetStateAction<string>>, onEnter: Function}) {
  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
      <br/><br/>
      <input 
        placeholder="Enter apple music URL" 
        className="w-full outline-0 focus:outline-0 border-b-2 border-b-gray-400  focus:border-b-cyan-600 pb-1" 
        value={searchText} 
        onChange={e => {onSearchTextChange(e.target.value);}} 
        onKeyDown={e => {if (e.key === "Enter") onEnter();}}
      />
      <br/><br/>
    </>
  );
}

function ResultsList({searchText, results}: {searchText: string, results: ResultMusicTrack[] | undefined}) {
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

  const { searchText, results, search, setSearchText } = useRoomController(roomID);

  return (
    <div className="max-w-3/4 mx-auto">
      <SearchBar searchText={searchText}
        onSearchTextChange={setSearchText}
        onEnter={() => search(searchText)} />
      <ResultsList searchText={searchText} results={results}/>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);