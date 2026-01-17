import React from "react";
import { Button } from "../../components/Button";
import {useControllerContext, useRoomControllerMessageTypeListener} from "../RoomController";
import {ResultsPlayerList} from "./ResultsPlayerList";
import {PlaylistCard} from "../../components/PlaylistCard";


/**
 * Component for displaying list of songs played during the game round.
 * Shows all songs that were played with their title, artist, and cover art.
 */
function PlayedSongsList() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_played_songs");

  return controller.playedSongs.length > 0 && (
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4 text-center">
          Played Songs
        </h3>
        <div className="space-y-2 mx-auto">
          {controller.playedSongs.map((song, idx) => (
              <PlaylistCard
                  index={idx}
                  title={song.name}
                  subtitle={song.artist}
                  coverURL={song.cover}
                  hrefURL={song.hrefURL} />
          ))}
        </div>
      </div>
  );
}

/**
 * Component for displaying game results after all questions are answered.
 * Shows ranked list of players who played the game with their points.
 */
export function Results() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");

  if (controller.state !== "results") return null;

  // sort by descending score
  let rankedPlayers = controller.players.sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-6 lg:max-w-3/4 2xl:max-w-1/2 mx-auto p-4 min-h-full">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">
          Game Results
        </h2>
        <p className="text-disabled-text">
          Final rankings and scores
        </p>
      </div>

      <ResultsPlayerList
          rankedPlayers={rankedPlayers}
          showField="points"/>

      {controller.isHost && (
          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mt-8 mb-16">
            <Button onClick={() => controller.returnTo("lobby")}>
              Return to Lobby
            </Button>
            <Button onClick={() => controller.startGame()}>
              Play Again
            </Button>
          </div>
      )}

      <PlayedSongsList />
    </div>
  );
}