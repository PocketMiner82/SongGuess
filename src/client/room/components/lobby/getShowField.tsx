import type { ReactNode } from "react";
import type { PlayerAnswerData, PlayerMessage } from "../../../../types/MessageTypes";
import { PlayerMessageSchema } from "../../../../schemas/ServerMessageSchemas";


export type PossibleFields = Exclude<(keyof PlayerAnswerData | keyof PlayerMessage), "answerData">;

const playerMessageFieldNames = Object.keys(PlayerMessageSchema.shape);

export function getShowField(player: PlayerMessage | null, showField?: PossibleFields): ReactNode | undefined {
  if (!showField || !player) {
    return undefined;
  }

  if (playerMessageFieldNames.includes(showField)) {
    // also show amount of points player got in the round if available
    if (showField === "points" && player.answerData?.questionPoints) {
      const { questionPoints } = player.answerData;
      return (
        <div className="flex flex-col justify-center items-center">
          <div>{player.points}</div>
          <div className={`${questionPoints > 0 ? "text-success" : "text-error"}`}>
            {questionPoints >= 0 ? "+" : ""}
            {questionPoints}
          </div>
        </div>
      );
    }
    return player[showField as Exclude<keyof PlayerMessage, "answerData">];
  } else if (player.answerData) {
    if (showField === "answerSpeed" && (player.answerData.questionPoints ?? 0) > 0) {
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
