import React, { useState, useCallback } from "react";
import { PlayerCard } from "./PlayerCard";
import { Button } from "../../components/Button";
import { useControllerContext, useGameState, useIsHost, useRoomControllerListener } from "../RoomController";
import type { ServerMessage } from "../../../schemas/RoomMessageSchemas";
import type { PlayerState } from "../../../schemas/RoomServerMessageSchemas";
import type { RoomController } from "../RoomController";

/**
 * Custom React hook to manage and provide the ranked list of players.
 * 
 * @param controller The RoomController instance to listen to.
 * @returns The current ranked list of players sorted by points.
 */
function useRankedPlayers(controller: RoomController) {
  const [rankedPlayers, setRankedPlayers] = useState<PlayerState[]>([]);

  const listener = useCallback((msg: ServerMessage|null) => {
    if (!msg || msg.type === "update") {
      const ranked = controller.players
        .filter(player => player.points >= 0) // Only show players who played
        .sort((a, b) => b.points - a.points); // Sort by descending score
      setRankedPlayers(ranked);
    }
  }, [controller.players]);

  useRoomControllerListener(controller, listener);

  return rankedPlayers;
}

/**
 * Component for displaying game results after all questions are answered.
 * Shows ranked list of players who played the game with their points.
 */
export function Results() {
  const controller = useControllerContext();
  const state = useGameState(controller);
  const isHost = useIsHost(controller);
  const rankedPlayers = useRankedPlayers(controller);

  if (state !== "results") return null;

  return (
    <div className="space-y-6 lg:max-w-3/4 2xl:max-w-1/2 mx-auto p-4 h-screen">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">
          Game Results
        </h2>
        <p className="text-disabled-text">
          Final rankings and scores
        </p>
      </div>

      {rankedPlayers.length === 0 ? (
        <div className="text-center text-disabled-text">
          <div className="material-symbols-outlined text-6xl mb-4">emoji_events</div>
          <p className="text-xl">No players scored points yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rankedPlayers.map((player, index) => (
            <div key={player.username} className="flex items-center gap-4">
              {/* Rank number */}
              <div className="flex items-center justify-center min-w-12 min-h-12 rounded-full bg-card-bg text-lg font-bold">
                {index + 1}
              </div>
              
              {/* Player card with points */}
              <div className="flex-1">
                <PlayerCard
                  player={player}
                  username={controller.username}
                  showPoints={true}
                />
              </div>
              
              {/* Trophy icon for top 3 */}
              {index < 3 && (
                <div className={`material-symbols-outlined text-2xl ${
                  index === 0 ? "text-yellow-500" : 
                  index === 1 ? "text-gray-400" : 
                  "text-orange-600"
                }`}>
                  emoji_events
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Host-only buttons */}
      {isHost && (
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mt-8">
          <Button onClick={() => controller.startGame()}>
            Play Again
          </Button>
          <Button onClick={() => controller.returnToLobby()}>
            Return to Lobby
          </Button>
        </div>
      )}
    </div>
  );
}