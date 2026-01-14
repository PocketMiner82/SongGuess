import { createRoot } from "react-dom/client";
import { useState } from "react";
import { fetchPostCreateRoom } from "../RoomHTTPHelper";
import { Button } from "./components/Button";
import { ErrorLabel } from "./components/ErrorLabel";
import { TopBar } from "./components/TopBar";
import {CookieConsent} from "react-cookie-consent";
import { downloadFile, importPlaylistFile, refreshPlaylists, validatePlaylistsFile } from "../Utils";
import type { PlaylistsFile } from "../schemas/RoomSharedSchemas";


/**
 * Main application component for the landing page.
 * Displays the SongGuess title and a button to create a new room.
 */
function App() {
  const [error, setError] = useState<string|null>(null);
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [refreshProgress, setRefreshProgress] = useState<string>("");

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

  /**
   * Handles refresh playlist button click.
   * Prompts user to select a file, refreshes all playlists, and allows download.
   */
  const handleRefreshPlaylists = async () => {
    const isConfirmed = window.confirm(
      "This will refresh all playlists in the selected file.\nThis could take some time and make a lot of API calls.\n\nDo you want to continue?"
    );

    if (!isConfirmed) return;

    // Create file input for selecting sgjson file
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".sgjson";
    fileInput.onchange = async (e) => {
      const event = e as any;
      if (!event.target.files?.[0]) return;

      setRefreshStatus("loading");
      setRefreshProgress("Reading file...");

      try {
        // Import and validate the playlist file
        const data = await importPlaylistFile(event);
        if (!data) {
          setError("Failed to read file.");
          setRefreshStatus("error");
          return;
        }

        const playlistsFile = validatePlaylistsFile(data);
        if (!playlistsFile) {
          setError("Invalid playlist file format.");
          setRefreshStatus("error");
          return;
        }

        setRefreshProgress(`Refreshing ${playlistsFile.playlists.length} playlist(s)...`);

        // Refresh all playlists
        const refreshedPlaylists = await refreshPlaylists(
          playlistsFile.playlists,
          (current, total, playlist) => {
            if (playlist) {
              setRefreshProgress(`Refreshing ${current}/${total}: ${playlist.name}`);
            } else {
              setRefreshProgress("Complete! Preparing download...");
            }
          }
        );

        // Create refreshed playlists file
        const refreshedFile: PlaylistsFile = {
          version: playlistsFile.version,
          playlists: refreshedPlaylists
        };

        // Download the refreshed file
        const content = JSON.stringify(refreshedFile, null, 2);
        const filename = `SongGuessPlaylists_Refreshed_${new Date().toISOString().slice(0, 10)}.sgjson`;
        downloadFile(content, filename);

        setRefreshStatus("success");
        setRefreshProgress("File downloaded successfully!");

        // Reset status after 3 seconds
        setTimeout(() => {
          setRefreshStatus("idle");
          setRefreshProgress("");
        }, 3000);

      } catch (error) {
        console.error("Error refreshing playlists:", error);
        setError("Failed to refresh playlists. Please try again.");
        setRefreshStatus("error");
        setRefreshProgress("");
      }
    };

    fileInput.click();
  };

  return (
    <div className="flex flex-col h-screen">
      <CookieConsent location="bottom" buttonText="I understand" overlay >
        This website uses cookies to to enhance the user experience. Only technically necessary cookies are used.
      </CookieConsent>

      <TopBar />
      <div className="flex items-center justify-center flex-1 p-4">
        <div className="m-auto justify-items-center text-center max-w-full">
          <Button
              onClick={() => window.location.href = "/transferPlaylist"}
              className="py-2 px-4 mb-4"
          >
            Transfer Playlist
          </Button>

          <div className="mb-8">
            <Button
              onClick={handleRefreshPlaylists}
              disabled={refreshStatus === "loading"}
              className="py-2 px-4 mb-2"
            >
              { refreshStatus === "loading" && (
                  <span className="material-symbols-outlined mr-2 animate-spin">
                    progress_activity
                  </span>
              )}
              Refresh Playlist
            </Button>

            {refreshStatus !== "idle" && (
              <div className={`text-sm mt-2 items-center justify-center ${
                refreshStatus === "error" ? "text-error" : 
                refreshStatus === "success" ? "text-success" : 
                "text-gray-600"
              }`}>
                {refreshProgress}
              </div>
            )}
          </div>

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