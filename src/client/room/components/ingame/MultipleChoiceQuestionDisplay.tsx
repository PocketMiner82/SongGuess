import {
  useControllerContext,
  useRoomControllerListener,
  useRoomControllerMessageTypeListener
} from "../../RoomController";
import {memo, useCallback, useEffect, useState} from "react";
import {ProgressBar} from "./ProgressBar";
import {ROUND_PADDING_TICKS} from "../../../../ConfigConstants";
import type {PlayerMessage} from "../../../../types/MessageTypes";
import {Button} from "../../../components/Button";
import {PlayerAvatar} from "../PlayerAvatar";


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
  playerAnswers: PlayerMessage[] | null;
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
          .filter(player => player.answerData?.answerIndex === index)
          .sort((a, b) => (a.answerData?.answerTimestamp || 0) - (b.answerData?.answerTimestamp || 0))
      : [];

  return (
      <div className="relative">
        <Button
            onClick={() => onSelect(index)}
            disabled={isDisabled}
            defaultColors={false}
            className={`w-full min-w-75 min-h-15 xl:w-100 xl:h-25 text-center justify-start transition-colors ${getButtonStyle()}`}
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
export function MultipleChoiceQuestionDisplay() {
  const controller = useControllerContext();
  const [canAnswer, setCanAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  useRoomControllerMessageTypeListener(controller, "audio_control");

  useRoomControllerListener(controller, useCallback(msg => {
    if (msg?.type === "question") {
      // reset selection
      setIsPlaying(false);
      return true;
    } else if (msg?.type === "answer") {
      // answering no longer allowed when server publishes correct answer
      setCanAnswer(false);
      setIsPlaying(false);
      return true;
    } else if (msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer") {
      setCanAnswer(false);
      return true;
    }
    return false;
  }, []));

  useEffect(() => {
    if (controller.ingameData.currentAudioState === "play") {
      // allow answering when music starts
      setCanAnswer(controller.ingameData.currentAnswer === null && controller.ingameData.selectedAnswer === null);
      setIsPlaying(controller.ingameData.currentAnswer === null);
    } else if (controller.ingameData.currentAudioState === "load") {
      setIsPlaying(true);
      setCanAnswer(false);
    } else {
      // pause or null state
      setIsPlaying(false);
      setCanAnswer(false);
    }
  }, [controller.ingameData.currentAudioState, controller.ingameData.currentAnswer, controller.ingameData.selectedAnswer]);

  // select answer if answering is allowed
  const handleAnswerSelect = useCallback((answerIndex: number) => {
    if (!canAnswer) return;
    controller.selectAnswer(answerIndex);
  }, [canAnswer, controller]);

  if (!controller.ingameData.currentQuestion && !controller.ingameData.currentAnswer) {
    return (
        <>
          <div className="material-symbols-outlined animate-spin text-gray-500 mb-8">progress_activity</div>
          <div className="text-2xl">Loading question...</div>
        </>
    );
  }

  const answerOptions = controller.ingameData.currentAnswer?.answerOptions || controller.ingameData.currentQuestion?.answerOptions;
  const correctIndex = controller.ingameData.currentAnswer?.correctIndex;
  const questionNumber = controller.ingameData.currentQuestion?.number || controller.ingameData.currentAnswer?.number;
  const isDisabled = !canAnswer;

  return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            Question {questionNumber!}/{controller.config.questionsCount}
          </h2>
          <p className="text-disabled-text">
            Select the correct song title
          </p>
        </div>

        <div className="mx-auto w-3/4">
          <ProgressBar duration={controller.ingameData.currentAudioState === "load"
              ? -(ROUND_PADDING_TICKS - 0.5)
              : controller.config.timePerQuestion - 0.5
          } isPlaying={isPlaying} positionOffset={controller.ingameData.currentAudioPosition} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {answerOptions!.map((option, index) => (
              <AnswerOption
                  key={index}
                  option={option}
                  index={index}
                  isSelected={controller.ingameData.selectedAnswer === index}
                  isCorrect={correctIndex !== undefined ? correctIndex === index : null}
                  isDisabled={isDisabled}
                  onSelect={handleAnswerSelect}
                  playerAnswers={controller.playerMessages}
              />
          ))}
        </div>
      </div>
  );
}