import type { PlayerMessage } from "../../../../types/MessageTypes";
import { memo, useCallback } from "react";
import GamePhase from "../../../../shared/game/GamePhase";
import { Button } from "../../../components/Button";
import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "../../RoomController";
import { PlayerAvatar } from "../PlayerAvatar";


type AnswerState = "pending" | "selected" | "correct" | "incorrect" | "disabled";

/**
 * Returns the appropriate CSS class for the answer button based on its state.
 */
function getAnswerButtonClass(state: AnswerState): string {
  switch (state) {
    case "correct":
      return "bg-success text-white";
    case "incorrect":
      return "bg-error text-white";
    case "selected":
      return "bg-secondary text-white";
    case "pending":
    case "disabled":
    default:
      return "bg-card-bg disabled:bg-card-bg text-default hover:bg-card-hover-bg";
  }
}

const AnswerOption = memo(({
  option,
  index,
  state,
  onSelect,
  playerAnswers,
}: {
  option: string;
  index: number;
  state: AnswerState;
  onSelect: (index: number) => void;
  playerAnswers: PlayerMessage[] | null;
}) => {
  // Filter and sort players who selected this answer
  const playersForThisAnswer = playerAnswers
    ? playerAnswers
        .filter(player => player.answerData?.answerIndex === index)
        .sort((a, b) => (a.answerData?.answerTimestamp || 0) - (b.answerData?.answerTimestamp || 0))
    : [];

  return (
    <div className="relative">
      <Button
        onClick={() => onSelect(index)}
        disabled={state !== "pending"}
        variant="plain"
        className={`w-full h-auto py-5 lg:w-100 lg:min-h-25 text-center justify-start transition-colors ${getAnswerButtonClass(state)}`}
      >
        {option}
      </Button>

      {playersForThisAnswer.length > 0 && (
        <div className="absolute -top-2 -right-2 flex">
          {playersForThisAnswer.map((player, playerIndex) => (
            <div
              key={player.username}
              className="rounded-full border-2 border-card-bg"
              style={{
                marginLeft: playerIndex > 0 ? "-8px" : "0",
                zIndex: playersForThisAnswer.length - playerIndex,
              }}
            >
              <PlayerAvatar size={24} player={player} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * Displays the current question with answer options.
 * Handles answer selection and shows results when answer is revealed.
 */
export function MultipleChoiceQuestionDisplay() {
  const controller = useControllerContext();

  useRoomControllerMessageTypeListener(controller, "audio_control");
  useRoomControllerMessageTypeListener(controller, "round_state");
  useRoomControllerMessageTypeListener(controller, "room_state");

  useRoomControllerListener(controller, useCallback((msg) => {
    return msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer";
  }, []));

  const canAnswer = controller.questionData.roundMsg?.gamePhase === GamePhase.ANSWERING
    && controller.questionData.selectedAnswerIndex === undefined;

  // select answer if answering is allowed
  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (!canAnswer)
      return;
    controller.selectAnswer(answerIndex);
  }, [canAnswer, controller]);

  let answerOptions: string[] | undefined;
  let correctIndex: number | undefined;
  if (controller.questionData.roundMsg?.question?.questionType === "multiple_choice") {
    answerOptions = controller.questionData.roundMsg.question.answerOptions;
    correctIndex = controller.questionData.roundMsg.question.correctAnswerIndex;
  }

  return (
    <div className="space-y-6 text-center">
      <h3 className="text-lg font-bold">
        Select the correct song title
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {answerOptions!.map((option, index) => {
          const isSelected = controller.questionData.selectedAnswerIndex === index;
          const isCorrect = correctIndex !== undefined ? correctIndex === index : null;

          let state: AnswerState = "pending";
          if (isCorrect !== null && isCorrect) {
            state = "correct";
          } else if (isCorrect !== null && !isCorrect && isSelected) {
            state = "incorrect";
          } else if (isSelected) {
            state = "selected";
          } else if (controller.questionData.roundMsg?.gamePhase !== GamePhase.ANSWERING || controller.questionData.selectedAnswerIndex !== undefined) {
            state = "disabled";
          }

          return (
            <AnswerOption
              key={index}
              option={option}
              index={index}
              state={state}
              onSelect={handleAnswerSelect}
              playerAnswers={controller.playerMessages}
            />
          );
        })}
      </div>
    </div>
  );
}
