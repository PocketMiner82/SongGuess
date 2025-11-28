import { lookup, type ResultMusicTrack } from "itunes-store-api";
import "./index.css";
import { createRoot } from "react-dom/client";
import { useCallback, useState, type Dispatch, type JSX, type SetStateAction } from "react";


function Audio({trackName, url}: {trackName: string, url: string}) {
  return (
    <>
    {trackName}:
    <audio controls>
      <source src={url} type="audio/aac"/>
    </audio>
    <br/>
    </>
  );
}

function SearchBar({searchText, onSearchTextChange, onEnter}: {searchText: string, onSearchTextChange: Dispatch<SetStateAction<string>>, onEnter: Function}) {
  return (
    <>
    <a target="_blank" rel="noopener noreferrer" href="https://music.apple.com/" className="text-pink-600 underline">Search Apple Music</a>
    <br/><br/>
    <input placeholder="Enter apple music URL" className="w-full outline-0 focus:outline-0 border-b-2 border-b-gray-400  focus:border-b-cyan-600" value={searchText} onChange={e => {onSearchTextChange(e.target.value);}} onKeyDown={e => {if (e.key === "Enter") onEnter();}}/>
    <br/><br/>
    </>
  );
}

function ResultsList({searchText, results}: {searchText: string, results: ResultMusicTrack[] | undefined}) {
  if (!results) results = []

  return (
    <>
    Songs for "{searchText}" ({results.length}):
    <br/><br/>

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
    </>
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
      var { results } = await lookup("url", searchText, {
        entity: "song",
        limit: 200,
        magicnumber: Date.now()
      });
    }

    setResults(results);
  }, [setResults, searchText]);

  return (
    <>
    <SearchBar searchText={searchText} onSearchTextChange={setSearchText} onEnter={handleEnter} />
    {results ? <ResultsList searchText={searchText} results={results}/> : "" }
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);