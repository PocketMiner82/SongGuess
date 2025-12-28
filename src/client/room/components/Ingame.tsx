import { useState, useCallback, memo } from "react";
import type { ServerMessage } from "../../../schemas/RoomMessageSchemas";
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
  isCorrect: boolean;
  isDisabled: boolean;
  onSelect: (index: number) => void;
}) {
  const getButtonStyle = () => {
    if (isDisabled && isCorrect) {
      return "bg-green-500 text-white hover:bg-green-600";
    }
    if (isDisabled && isSelected && !isCorrect) {
      return "bg-red-500 text-white hover:bg-red-600";
    }
    if (isSelected) {
      return "bg-secondary text-white hover:bg-secondary-hover";
    }
    return "bg-card-bg text-default hover:bg-gray-200 dark:hover:bg-gray-700";
  };

  return (
    <Button
      onClick={() => onSelect(index)}
      disabled={isDisabled}
      className={`w-full p-4 text-left justify-start transition-colors ${getButtonStyle()}`}
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

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "question") {
      setCurrentQuestion(msg);
      setCurrentAnswer(null);
      setSelectedAnswer(null);
      setCanAnswer(true);
    } else if (msg.type === "answer") {
      setCurrentAnswer(msg);
      setCanAnswer(false);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (!canAnswer || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    
    controller.selectAnswer(answerIndex);
  }, [canAnswer, selectedAnswer, controller]);

  if (!currentQuestion) {
    return (
      <div className="text-center text-disabled-text">
        <p>Waiting for question...</p>
      </div>
    );
  }

  const answerOptions = currentAnswer?.answerOptions || currentQuestion.answerOptions;
  const correctIndex = currentAnswer?.correctIndex;
  const isDisabled = !canAnswer;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">
          Question {currentQuestion.number}
        </h2>
        <p className="text-disabled-text">
          Select the correct song title
        </p>
      </div>

      <div className="space-y-3">
        {answerOptions.map((option, index) => (
          <AnswerOption
            key={index}
            option={option}
            index={index}
            isSelected={selectedAnswer === index}
            isCorrect={correctIndex === index}
            isDisabled={isDisabled}
            onSelect={handleAnswerSelect}
          />
        ))}
      </div>

      {currentAnswer && (
        <div className="text-center space-y-4">
          <div className="text-lg">
            {selectedAnswer === correctIndex ? (
              <span className="text-green-500 font-medium">✓ Correct!</span>
            ) : (
              <span className="text-red-500 font-medium">✗ Wrong answer</span>
            )}
          </div>
          
          <div className="text-sm text-disabled-text">
            <p>Players who answered correctly:</p>
            <ul className="mt-2 space-y-1">
              {currentAnswer.playerAnswers
                .filter(player => player.answerIndex === correctIndex)
                .map(player => (
                  <li key={player.username} className="flex items-center justify-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: player.color }}
                    />
                    <span>{player.username}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      )}
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

  const listener = useCallback((msg: ServerMessage) => {
    if (msg.type === "update") {
      setState(msg.state);
    }
  }, []);

  useRoomControllerListener(controller, listener);

  if (state !== "ingame") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto">
      <QuestionDisplay />
    </div>
  );
}