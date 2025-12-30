import React, { useState, useCallback, memo } from "react";
import type { QuestionMessage, AnswerMessage, GameState, PlayerState } from "../../../schemas/RoomServerMessageSchemas";
import { Button } from "../../components/Button";
import { PlayerAvatar } from "./PlayerAvatar";
import { useControllerContext, useRoomControllerListener, useGameState } from "../RoomController";

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
  onSelect,
  playerAnswers
}: {
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean|null;
  isDisabled: boolean;
  onSelect: (index: number) => void;
  playerAnswers: PlayerState[] | null;
}) {
  const getButtonStyle = () => {
    if (isCorrect) {
      return "bg-success text-white";
    }
    if (isSelected && isCorrect === false) {
      return "bg-error text-white";
    }
    if (isSelected) {
      return "bg-secondary text-white";
    }
    return "bg-card-bg disabled:bg-card-bg text-default hover:bg-card-hover-bg";
  };

  // Filter and sort players who selected this answer
  const playersForThisAnswer = playerAnswers
    ? playerAnswers
        .filter(player => player.answerIndex === index)
        .sort((a, b) => (a.answerTimestamp || 0) - (b.answerTimestamp || 0))
    : [];

  return (
    <div className="relative">
      <Button
        onClick={() => onSelect(index)}
        disabled={isDisabled}
        defaultColors={false}
        className={`w-60 min-h-15 xl:w-100 xl:min-h-25 text-center justify-start transition-colors ${getButtonStyle()}`}
      >
        {option}
      </Button>
      
      {/* Show player avatars during answer phase */}
      {isCorrect !== null && playersForThisAnswer.length > 0 && (
        <div className="absolute -top-2 -right-2 flex">
          {playersForThisAnswer.map((player, playerIndex) => (
            <div
              key={player.username}
              className="rounded-full border-2 border-card-bg"
              style={{
                marginLeft: playerIndex > 0 ? '-8px' : '0',
                zIndex: playersForThisAnswer.length - playerIndex
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
function QuestionDisplay() {
  const controller = useControllerContext();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionMessage | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerMessage | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [canAnswer, setCanAnswer] = useState(false);

  useRoomControllerListener(controller, useCallback(msg => {
    setCurrentQuestion(controller.currentQuestion);
    setCurrentAnswer(controller.currentAnswer);

    if (msg?.type === "question") {
      // reset selection
      setSelectedAnswer(null);
    } else if (msg?.type === "audio_control" && msg.action === "play") {
      // allow answering when music starts
      setCanAnswer(true);
    } else if (msg?.type === "answer") {
      // answering no longer allowed when server publishes correct answer
      setCanAnswer(false);
    }
  }, [controller.currentAnswer, controller.currentQuestion]));

  // select answer if answering is allowed
  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (!canAnswer) return;
    
    setSelectedAnswer(answerIndex);
    setCanAnswer(false);
    
    controller.selectAnswer(answerIndex);
  }, [canAnswer, controller]);

  if (!currentQuestion && !currentAnswer) {
    return (
        <>
          <div className="material-symbols-outlined animate-spin text-gray-500 mb-8">progress_activity</div>
          <div className="text-2xl">Waiting for next question...</div>
        </>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {answerOptions!.map((option, index) => (
          <AnswerOption
            key={index}
            option={option}
            index={index}
            isSelected={selectedAnswer === index}
            isCorrect={correctIndex !== undefined ? correctIndex === index : null}
            isDisabled={isDisabled}
            onSelect={handleAnswerSelect}
            playerAnswers={currentAnswer?.playerAnswers || null}
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
  const state = useGameState(controller);

  if (state !== "ingame") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto h-screen flex items-center justify-center p-4">
      <div className="m-auto justify-items-center text-center max-w-full">
        <QuestionDisplay />
      </div>
    </div>
  );
}