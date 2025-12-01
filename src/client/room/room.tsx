import "./room.css";

import usePartySocket from "partysocket/react";
import { lookup, type ResultMusicTrack } from "itunes-store-api";
import { createRoot } from "react-dom/client";
import { useCallback, useState, useEffect, type Dispatch, type SetStateAction, useRef } from "react";

declare const PARTYKIT_HOST: string;

function ConnectionLogger() {
  const roomID = new URLSearchParams(window.location.search).get("id") ?? "null";
  const [logs, setLogs] = useState<string[]>([]);
  
  // Create a reference to the scrollable element
  const logContainerRef = useRef<HTMLDivElement>(null);

  const socket = usePartySocket({
    host: PARTYKIT_HOST,
    room: roomID,
    onOpen() {
      setLogs((prev) => [...prev, `Connected to ${roomID}!`, "Sending a ping every 2 seconds..."]);
    },
    onMessage(event) {
      setLogs((prev) => [...prev, `Received -> ${event.data}`]);
    },
    onClose(ev) {
      setLogs((prev) => [...prev, `Disconnected (${ev.code})`]);
    },
    onError(ev) {
      setLogs((prev) => [...prev, "Cannot connect to this room."]);
    }
  });

  // Handle the ping interval
  useEffect(() => {
    const interval = setInterval(() => {
      socket.send("ping");
    }, 1000);
    return () => clearInterval(interval);
  }, [socket]);

  // Scroll to the bottom whenever the 'logs' state is updated
  useEffect(() => {
    const container = logContainerRef.current;
    if (container) {
      // This property sets the current scroll position to the bottom of the content
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);


  return (
    <div className="mb-8">
      <h3 className="font-bold mb-2">Room Activity</h3>
      <div 
        ref={logContainerRef} 
        className="bg-gray-700 p-2 rounded max-h-60 overflow-y-auto font-mono text-xs text-white" 
      >
        {logs.map((log, index) => (
          <div key={index}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
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

function SearchBar({searchText, onSearchTextChange, onEnter}: {searchText: string, onSearchTextChange: Dispatch<SetStateAction<string>>, onEnter: Function}) {
  return (
    <>
      <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
      <br/><br/>
      <input 
        placeholder="Enter apple music URL or Search Term" 
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
  if (!results) return null;

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
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<ResultMusicTrack[]>();

  const handleEnter = useCallback(async () => {
    try {
      var { results } = await lookup("url", searchText, {
        entity: "song",
        limit: 200
      });
    } catch {
      // @ts-ignore
      results = await lookup("url", searchText, {
        entity: "song",
        limit: 200,
        magicnumber: Date.now()
      });
    }

    setResults(results);
  }, [searchText]);

  return (
    <div className="max-w-3/4 mx-auto">
      <ConnectionLogger />
      <SearchBar searchText={searchText} onSearchTextChange={setSearchText} onEnter={handleEnter} />
      <ResultsList searchText={searchText} results={results}/>
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);