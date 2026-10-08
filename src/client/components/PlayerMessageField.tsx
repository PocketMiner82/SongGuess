import type { PlayerAnswerData, PlayerMessage } from "../../types/MessageTypes";
import type { PossibleShowFields } from "../../types/PossibleShowFields";
import { PlayerMessageSchema } from "../../schemas/ServerMessageSchemas";


const playerMessageFieldNames = Object.keys(PlayerMessageSchema.shape);

export function PlayerMessageField({ player, showField, className }:
{
  player: PlayerMessage | null;
  showField?: PossibleShowFields;
  className?: string;
}) {
  if (!showField || !player) {
    return undefined;
  }

  let answerText: string | number | boolean | undefined;

  if (showField === "questionPoints") {
    const questionPoints = player.answerData?.questionPoints;
    if (questionPoints) {
      return (
        <div className={`text-sm ${questionPoints > 0 ? "text-success" : "text-error"} ${className}`}>
          {questionPoints > 0 ? "+" : "-"}
          {questionPoints}
        </div>
      );
    }
  } else if (playerMessageFieldNames.includes(showField)) {
    answerText = player[showField as Exclude<keyof PlayerMessage, "answerData">];
  } else if (player.answerData) {
    if (showField === "answerSpeed" && (player.answerData.questionPoints ?? 0) > 0) {
      answerText = `${(player.answerData.answerSpeed / 1000).toFixed(3)} s`;
    } else if (showField === "answer") {
      answerText = player.answerData.answer ? `"${player.answerData.answer}"` : undefined;
    } else if (showField !== "answerSpeed") {
      answerText = player.answerData[showField as keyof PlayerAnswerData];
    }
  }

  if (answerText === undefined) {
    return undefined;
  }

  return (
    <div className={`text-sm ${className}`}>
      {answerText}
    </div>
  );
}
