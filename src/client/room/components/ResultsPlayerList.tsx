import React from "react";
import {PlayerCard} from "./PlayerCard";
import {useControllerContext} from "../RoomController";
import type {PlayerState} from "../../../schemas/RoomServerMessageSchemas";

export function ResultsPlayerList({rankedPlayers, showField}: {rankedPlayers: PlayerState[], showField: keyof PlayerState}) {
  const controller = useControllerContext();

  rankedPlayers = rankedPlayers.filter(p => p[showField] !== undefined);

  return (
      <div className="space-y-3">
        {rankedPlayers.map((player, index) => (
            <div key={player.username} className="flex items-center gap-4">
              <div className={`flex items-center justify-center min-w-12 min-h-12 rounded-full 
        bg-card-bg text-lg font-bold ${
                  index === 0 ? "text-yellow-500" :
                      index === 1 ? "text-gray-400" :
                          index === 2 ? "text-orange-600" :
                              "text-default"
              }`}>
                {index + 1}
              </div>

              <div className="flex-1">
                <PlayerCard
                    player={player}
                    username={controller.username}>
                  {showField === "answerSpeed" ?
                      `${player.answerSpeed! / 1000} s` :
                      player[showField]
                  }
                </PlayerCard>
              </div>
            </div>
        ))}
      </div>
  );
}