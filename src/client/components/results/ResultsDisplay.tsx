import { useMemo } from "react";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { Button } from "../Button";
import { PlayedSongsList } from "./PlayedSongsList";
import { ResultsPlayerList } from "./ResultsPlayerList";


/**
 * Component for displaying game results after all questions are answered.
 * Shows ranked list of players who played the game with their points.
 */
export function ResultsDisplay() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  // sort by descending score
  const rankedPlayers = useMemo(() =>
    [...controller.playerMessages].sort((a, b) => b.points - a.points), [controller.playerMessages]);

  if (controller.state !== "results")
    return null;

  return (
    <div className="space-y-6 2xl:max-w-3/4 mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-2">
          Game Results
        </h2>
        <p className="text-disabled-text">
          Final rankings and scores
        </p>
      </div>

      <ResultsPlayerList
        rankedPlayers={rankedPlayers}
        showField="points"
      />

      {controller.isHost && (
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mt-8 mb-16">
          <Button type="button" onClick={() => controller.returnTo("lobby")} aria-label="Return to lobby">
            Return to Lobby
          </Button>
          <Button type="button" onClick={() => controller.startGame()} aria-label="Start new game">
            Play Again
          </Button>
        </div>
      )}

      <PlayedSongsList />
    </div>
  );
}
