import {createRoot} from "react-dom/client";
import React, {useState} from "react";
import {CookieConsent} from "react-cookie-consent";
import {TopBar} from "./components/TopBar";
import {Button} from "./components/Button";
import {ErrorLabel} from "./components/ErrorLabel";
import {downloadFile} from "../Utils";
import {safeSearch} from "../Utils";
import Papa from "papaparse";
import type { ResultMusicTrack } from "itunes-store-api";
import type {Playlist, PlaylistsFile, Song} from "../schemas/RoomSharedSchemas";

interface CSVRow {
  "Track name": string;
  "Artist name": string;
  "Playlist name": string;
  "Album": string;
}

/**
 * Button component that imports playlists from a CSV file.
 */
function ImportCSV() { 
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [progress, setProgress] = useState<string>("");

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("loading");
    setProgress("Reading CSV file...");
    setError(null);

    try {
      // Read and parse CSV file
      const text = await file.text();
      const records: CSVRow[] = await new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          transform: (value) => value.trim(),
          complete: (results) => {
            if (results.errors.length > 0) {
              reject(new Error(results.errors.map(e => e.message).join(', ')));
            } else {
              resolve(results.data as CSVRow[]);
            }
          },
          error: (error: Error) => reject(error)
        });
      });

      if (!records || records.length === 0) {
        setError("CSV file is empty or invalid.");
        setStatus("error");
        return;
      }

      setProgress(`Processing ${records.length} tracks...`);

      // Validate required fields and group tracks by playlist name
      const playlistMap = new Map<string, CSVRow[]>();
      records.forEach(record => {
        const trackName = record["Track name"];
        const artistName = record["Artist name"];
        const playlistName = record["Playlist name"];
        const albumName = record["Album"];
        
        // Skip rows that don't have required fields
        if (!trackName || !artistName || !playlistName || !albumName) return;
        
        if (!playlistMap.has(playlistName)) {
          playlistMap.set(playlistName, []);
        }
        playlistMap.get(playlistName)!.push(record);
      });

      setProgress(`Found ${playlistMap.size} playlist(s). Searching for songs...`);

      // Create playlists and search for songs
      const playlists: Playlist[] = [];
      let processedCount = 0;
      let requestCount = 0;
      const notFoundSongs: string[] = [];

      for (const [playlistName, tracks] of playlistMap) {
        const playlist: Playlist = {
          name: playlistName,
          hrefURL: "https://music.apple.com/us/",
          cover: null,
          songs: []
        };

        for (const track of tracks) {
          processedCount++;

          // pause for one minute to avoid rate limits
          if (requestCount >= 20) {
            await new Promise<void>(r => {
              let sleep = 61;

              const update = () => {
                if (--sleep > 0) {
                  setProgress(`Waiting for ${sleep} second(s) to avoid rate limiting.`);
                  setTimeout(update, 1000);
                  return;
                }
                r();
              };

              update();
            });
            requestCount = 0;
          }

          setProgress(`Searching ${processedCount}/${records.length}: ${track["Track name"]} in album ${track["Album"]} by ${track["Artist name"]}`);

          try {
            // Search for song using iTunes Search API
            let searchTerm = `${track["Track name"]} ${track["Album"]}`;
            const searchTermArtist = `${track["Track name"]} ${track["Artist name"]}`;
            let tryAgain = false;

            do {
              tryAgain = false;
              requestCount++;
              const results = await safeSearch(searchTerm, {
                country: "de",
                media: "music",
                entity: "song",
                attribute: "songTerm",
                limit: 10
              });

              // Find first musicTrack (not musicVideo)
              const musicTrack = results.find((result): result is ResultMusicTrack =>
                  result.kind === "song" && result.wrapperType === "track"
              );

              if (musicTrack) {
                const song: Song = {
                  name: musicTrack.trackName,
                  audioURL: musicTrack.previewUrl,
                  artist: musicTrack.artistName,
                  hrefURL: musicTrack.trackViewUrl,
                  cover: musicTrack.artworkUrl100.replace(/100x100(bb.[a-z]+)$/, "486x486$1")
                };
                playlist.songs.push(song);
              } else if (searchTerm !== searchTermArtist) {
                tryAgain = true;
                searchTerm = searchTermArtist;
              } else {
                const notFoundSong = `${track["Track name"]} by ${track["Artist name"]}`;
                notFoundSongs.push(notFoundSong);
                console.warn(`No music track found for: ${notFoundSong}`);
              }
            } while (tryAgain);
          } catch (error) {
            const notFoundSong = `${track["Track name"]} by ${track["Artist name"]}`;
            notFoundSongs.push(notFoundSong);
            console.error(`Error searching for ${notFoundSong}:`, error);
          }
        }

        if (playlist.songs.length > 0) {
          playlist.subtitle = `Imported Playlist | ${playlist.songs.length} song${playlist.songs.length !== 1 ? "s" : ""}`;
          playlists.push(playlist);
        }
      }

      if (playlists.length === 0) {
        setError("No songs were found. Please check your CSV file format.");
        setStatus("error");
        return;
      }

      setProgress("Creating downloadable file...");

      // Create PlaylistsFile
      const playlistsFile: PlaylistsFile = {
        version: "1.0",
        playlists
      };

      // Download the file
      const content = JSON.stringify(playlistsFile, null, 2);
      const filename = `SongGuessPlaylists_Imported_${new Date().toISOString().slice(0, 10)}.sgjson`;
      downloadFile(content, filename);

      setStatus("success");
      const totalSongs = playlists.reduce((sum, p) => sum + p.songs.length, 0);
      let successMessage = `Successfully imported ${playlists.length} playlist(s) with ${totalSongs} song${totalSongs !== 1 ? "s" : ""}!`;
      
      if (notFoundSongs.length > 0) {
        const notFoundList = notFoundSongs.join("\n• ");
        setError(`Songs not found (${notFoundSongs.length} total):\n• ${notFoundList}`);
      }
      
      setProgress(successMessage);
    } catch (error) {
      console.error("Error importing CSV:", error);
      setError("Failed to import CSV file. Please check the file format and try again.");
      setStatus("error");
      setProgress("");
    }

    // Reset file input
    event.target.value = "";
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={handleImport}
        className="hidden"
        id="csv-import"
      />
      <Button
        onClick={() => document.getElementById("csv-import")?.click()}
        className="min-w-full"
        disabled={status === "loading"}
      >
        <span className="material-symbols-outlined mr-2">upload</span>
        Import CSV
      </Button>

      <ErrorLabel error={error} />

      {status !== "idle" && (
        <div className={`text-sm mt-2 items-center justify-center ${
          status === "error" ? "text-error" : 
          status === "success" ? "text-success" : 
          "text-gray-600"
        }`}>
          {progress}
        </div>
      )}
    </div>
  );
}

function App() {

  return (
      <div className="flex flex-col h-screen">
        <CookieConsent location="bottom" buttonText="I understand" overlay >
          This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
        </CookieConsent>

        <TopBar />

        <main className="flex-1 overflow-auto">
          <div className="lg:max-w-3/4 mx-auto p-4 min-h-full flex flex-col">
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-3xl font-bold mb-4">Transfer Playlists to SongGuess</h1>
                <p className="text-disabled-text mb-8">
                  Import playlists from any music service using a CSV file
                </p>
              </div>

              <div className="bg-card-bg rounded-lg p-6 space-y-4">
                <h2 className="text-xl font-bold mb-4">How to get a CSV file:</h2>

                <div className="space-y-4 text-default">
                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-secondary mt-1">looks_one</span>
                    <div>
                      <p className="font-semibold">Go to TuneMyMusic</p>
                      <a 
                        href="https://www.tunemymusic.com/transfer" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        https://www.tunemymusic.com/transfer
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-secondary mt-1">looks_two</span>
                    <div>
                      <p className="font-semibold">Select your streaming provider</p>
                      <p className="text-sm text-disabled-text">
                        Choose the service where your playlist is currently stored (Spotify, Apple Music, YouTube Music, etc.)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-secondary mt-1">looks_3</span>
                    <div>
                      <p className="font-semibold">Select the playlists</p>
                      <p className="text-sm text-disabled-text">
                        Connect to your music service and select the playlist(s) you want to transfer
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-secondary mt-1">looks_4</span>
                    <div>
                      <p className="font-semibold">Export as CSV</p>
                      <p className="text-sm text-disabled-text">
                        When asked for the destination, choose "Export file" → "CSV" to download your playlist as a CSV file
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <span className="material-symbols-outlined text-secondary mt-1">looks_5</span>
                    <div>
                      <p className="font-semibold">Import to SongGuess</p>
                      <p className="text-sm text-disabled-text">
                        Upload the received CSV file using the "Import CSV" button below
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-disabled-bg my-6"></div>

                <div className="text-center">
                  <ImportCSV />
                </div>
              </div>

              <div className="bg-card-bg rounded-lg p-4">
                <h3 className="font-semibold mb-2">Important Notes:</h3>
                <ul className="text-sm text-disabled-text space-y-1">
                  <li>• The CSV file should contain information about song title and artist</li>
                  <li>• Make sure the CSV is properly formatted with the correct headers</li>
                  <li>• Large playlists may take some time to process especially due to rate limiting of the iTunes Search API</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
  );
}

createRoot(document.getElementById("app")!).render(<App />);