import React, { useState, useCallback, useMemo } from "react";
import type { PlayerState, GameState } from "../../../schemas/RoomServerMessageSchemas";
import { PlayerCard } from "./PlayerCard";
import { useControllerContext, useRoomControllerListener } from "../RoomController";

/**
 * Component for displaying game results after all questions are answered.
 * Shows ranked list of players who played the game with their points.
 */
function Results() {
  const controller = useControllerContext();
  const [state, setState] = useState<GameState>("lobby");

  useRoomControllerListener(controller, useCallback(msg => {
    if (!msg || msg.type === "update") {
      setState(controller.state);
    }
  }, [controller.state]));

  // Filter active players and sort by descending points
  const rankedPlayers = useMemo(() => {
    return controller.players
      .filter(player => player.points >= 0) // Only show players who played
      .sort((a, b) => b.points - a.points); // Sort by descending score
  }, [controller.players]);

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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-card-bg text-lg font-bold">
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
    </div>
  );
}

export { Results };