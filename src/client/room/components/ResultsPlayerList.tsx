import React from "react";
import {PlayerCard} from "./PlayerCard";
import {useControllerContext} from "../RoomController";
import type {PlayerState} from "../../../schemas/RoomServerMessageSchemas";


function getShowField(player: PlayerState, showField: keyof PlayerState) {
  return (showField === "answerSpeed" && player.answerSpeed ?
      `${(player.answerSpeed / 1000).toFixed(3)} s` :
      player[showField]);
}

export function ResultsPlayerList({rankedPlayers, showField, showField2, showRankingNumbers = true}:
      {rankedPlayers: PlayerState[], showField: keyof PlayerState, showField2?: keyof PlayerState, showRankingNumbers?: boolean}) {
  const controller = useControllerContext();

  rankedPlayers = rankedPlayers.filter(p => p[showField] !== undefined);

  return (
      <div className="space-y-3">
        {rankedPlayers.map((player, index) => (
            <div key={player.username} className="flex items-center gap-4">
              {showRankingNumbers && (
                  <div className={`flex items-center justify-center min-w-12 min-h-12 rounded-full text-lg font-bold ${
                      index === 0 ? "text-black bg-[#d4af37]" :
                          index === 1 ? "text-black bg-[#c0c0c0]" :
                              index === 2 ? "text-black bg-[#cd7f32]" :
                                  "bg-card-bg"
                  }`}>
                    {index + 1}
                  </div>
              )}

              <div className="flex-1 flex items-center gap-y-4">
                <div className="flex-1">
                  <PlayerCard
                      player={player}
                      username={controller.username}>
                    {getShowField(player, showField)}
                  </PlayerCard>
                </div>
                { showField2 && getShowField(player, showField2) && (
                    <div className="flex text-lg justify-end font-medium min-w-24">
                      <div className="text-center w-full">
                        {getShowField(player, showField2)}
                      </div>
                    </div>
                )}
              </div>
            </div>
        ))}
      </div>
  );
}