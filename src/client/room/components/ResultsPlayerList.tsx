import React, { useMemo } from "react";
import {PlayerCard} from "./PlayerCard";
import type {PlayerAnswerData, PlayerMessage} from "../../../types/MessageTypes";
import {PlayerMessageSchema} from "../../../schemas/ServerMessageSchemas";

type PossibleFields = Exclude<(keyof PlayerAnswerData|keyof PlayerMessage), "answerData">;

const playerMessageFieldNames = Object.keys(PlayerMessageSchema.shape);

function getShowField(player: PlayerMessage, showField: PossibleFields): string|number|undefined {
  if (playerMessageFieldNames.indexOf(showField) !== -1) {
    return player[showField as Exclude<keyof PlayerMessage, "answerData">];
  } else if (player.answerData) {
    if (showField === "answerSpeed" && (player.answerData.roundPoints ?? 0) > 0) {
      return `${(player.answerData.answerSpeed / 1000).toFixed(3)} s`;
    } else if (showField !== "answerSpeed") {
      return player.answerData[showField as keyof PlayerAnswerData];
    }
  }

  return undefined;
}

export function ResultsPlayerList({rankedPlayers, showField, showField2, showRankingNumbers = true}:
      {rankedPlayers: PlayerMessage[], showField: PossibleFields, showField2?: PossibleFields, showRankingNumbers?: boolean}) {
  rankedPlayers = rankedPlayers.filter(p => getShowField(p, showField) !== undefined);

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
                  <PlayerCard player={player}>
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