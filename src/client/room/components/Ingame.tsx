import React, { useState, useCallback, memo } from "react";
import type { QuestionMessage, AnswerMessage, GameState } from "../../../schemas/RoomServerMessageSchemas";
import { Button } from "../../components/Button";
import { useControllerContext, useRoomControllerListener } from "../RoomController";

/**
 * Individual answer option button that handles selection and styling.
 * Shows different states based on whether it's selected, correct, or disabled.
 */
const AnswerOption = memo(function AnswerOption({
  option,
  index,
  isSelected,
  isCorrect,
  isDisabled,
  onSelect
}: {
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean|null;
  isDisabled: boolean;
  onSelect: (index: number) => void;
}) {
  const getButtonStyle = () => {
    if (isCorrect) {
      return "bg-success text-white";
    }
    if (isSelected && isCorrect === false) {
      return "bg-error text-white";
    }
    if (isSelected) {
      return "bg-secondary text-white hover:bg-secondary-hover";
    }
    return "bg-card-bg text-default hover:bg-card-hover-bg";
  };

  return (
    <Button
      onClick={() => onSelect(index)}
      disabled={isDisabled}
      defaultColors={false}
      className={`w-full text-left justify-start transition-colors ${getButtonStyle()}`}
    >
      <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
    </Button>
  );
});

/**
 * Displays the current question with answer options.
 * Handles answer selection and shows results when answer is revealed.
 */
function QuestionDisplay() {
  const controller = useControllerContext();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionMessage | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerMessage | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [canAnswer, setCanAnswer] = useState(false);

  useRoomControllerListener(controller, useCallback(msg => {
    setCurrentQuestion(controller.currentQuestion);
    setCurrentAnswer(controller.currentAnswer);
    setCanAnswer(controller.currentQuestion !== null);

    if (msg?.type === "question") {
      setSelectedAnswer(null);
    }
  }, [controller.currentAnswer, controller.currentQuestion]));

  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (!canAnswer || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    
    controller.selectAnswer(answerIndex);
  }, [canAnswer, selectedAnswer, controller]);

  if (!currentQuestion && !currentAnswer) {
    return (
        <div className="flex items-center justify-center h-screen p-4">
          <div className="m-auto justify-items-center text-center max-w-full">
            <div className="material-symbols-outlined animate-spin text-gray-500 mb-8">progress_activity</div>
            <div className="text-2xl">Waiting for next question...</div>
          </div>
        </div>
    );
  }

  const answerOptions = currentAnswer?.answerOptions || currentQuestion?.answerOptions;
  const correctIndex = currentAnswer?.correctIndex;
  const questionNumber = currentQuestion?.number || currentAnswer?.number;
  const isDisabled = !canAnswer;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Question {questionNumber!}
        </h2>
        <p className="text-disabled-text">
          Select the correct song title
        </p>
      </div>

      <div className="space-y-3">
        {answerOptions!.map((option, index) => (
          <AnswerOption
            key={index}
            option={option}
            index={index}
            isSelected={selectedAnswer === index}
            isCorrect={correctIndex !== undefined ? correctIndex === index : null}
            isDisabled={isDisabled}
            onSelect={handleAnswerSelect}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Main ingame component that only renders when game state is 'ingame'.
 * Displays the current question and handles answer selection.
 */
export function Ingame() {
  const controller = useControllerContext();
  const [state, setState] = useState<GameState>("lobby");

  useRoomControllerListener(controller, useCallback(msg => {
    if (!msg || msg.type === "update") {
      setState(controller.state);
    }
  }, [controller.state]));

  if (state !== "ingame") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto p-4 h-screen">
      <QuestionDisplay />
    </div>
  );
}