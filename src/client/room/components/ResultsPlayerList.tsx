import type { ReactNode } from "react";
import type { PlayerAnswerData, PlayerMessage } from "../../../types/MessageTypes";
import { useMemo } from "react";
import { PlayerMessageSchema } from "../../../schemas/ServerMessageSchemas";
import { PlayerCard } from "./PlayerCard";


type PossibleFields = Exclude<(keyof PlayerAnswerData | keyof PlayerMessage), "answerData">;

const playerMessageFieldNames = Object.keys(PlayerMessageSchema.shape);

function getShowField(player: PlayerMessage, showField: PossibleFields): ReactNode | undefined {
  if (playerMessageFieldNames.includes(showField)) {
    // also show amount of points player got in the round if available
    if (showField === "points" && player.answerData?.roundPoints) {
      const { roundPoints } = player.answerData;
      return (
        <>
          <span>{player.points}</span>
          <span className={`min-w-14 text-right ${roundPoints > 0 ? "text-success" : "text-error"}`}>
            {roundPoints >= 0 ? "+" : ""}
            {roundPoints}
          </span>
        </>
      );
    }
    return player[showField as Exclude<keyof PlayerMessage, "answerData">];
  } else if (player.answerData) {
    if (showField === "answerSpeed" && (player.answerData.roundPoints ?? 0) > 0) {
      return `${(player.answerData.answerSpeed / 1000).toFixed(3)} s`;
    } else if (showField !== "answerSpeed") {
      if (showField === "answer") {
        return `"${player.answerData.answer}"`;
      }
      return player.answerData[showField as keyof PlayerAnswerData];
    }
  }

  return undefined;
}

export function ResultsPlayerList({ rankedPlayers, showField, showField2, showField3, showRankingNumbers = true }:
{ rankedPlayers: PlayerMessage[]; showField: PossibleFields; showField2?: PossibleFields; showField3?: PossibleFields; showRankingNumbers?: boolean }) {
  const filteredPlayers = useMemo(() =>
    rankedPlayers.filter(p => getShowField(p, showField) !== undefined), [rankedPlayers, showField]);

  return (
    <div className="space-y-3">
      {filteredPlayers.map((player, index) => (
        <div key={player.username} className="flex items-center gap-4">
          {showRankingNumbers && (
            <div className={`flex items-center justify-center min-w-12 min-h-12 rounded-full text-lg font-bold ${
              index === 0
                ? "text-black bg-[#d4af37]"
                : index === 1
                  ? "text-black bg-[#c0c0c0]"
                  : index === 2
                    ? "text-black bg-[#cd7f32]"
                    : "bg-card-bg"
            }`}
            >
              {index + 1}
            </div>
          )}

          <div className="flex-1 flex flex-col bg-card-hover-bg rounded-lg">
            <div className="flex items-center w-full">
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

            {showField3 && getShowField(player, showField3) && (
              <div className="font-medium text-left p-3 text-sm text-disabled-text">
                {getShowField(player, showField3)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
