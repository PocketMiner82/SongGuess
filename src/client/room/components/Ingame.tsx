import React, { useState, useCallback, memo, useEffect, useRef } from "react";
import { Button } from "../../components/Button";
import { PlayerAvatar } from "./PlayerAvatar";
import {useControllerContext, useRoomControllerListener, useRoomControllerMessageTypeListener} from "../RoomController";
import {ResultsPlayerList} from "./ResultsPlayerList";
import type {PlayerState} from "../../../types/MessageTypes";

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
 * Progress bar component that shows time remaining for the current question.
 */
const ProgressBar = memo(function ProgressBar({ 
  duration, 
  isPlaying 
}: { 
  duration: number; 
  isPlaying: boolean; 
}) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying && duration) {
      let reversed = false;
      if (duration < 0) {
        reversed = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
        duration = -duration;
      }

      // Reset when starting
      setProgress(reversed ? 0 : 100);
      
      // Update progress every 100ms for smooth animation
      const intervalTime = 100;
      const change = (100 / duration) * (intervalTime / 1000);
      
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (reversed) {
            const newProgress = prev + change;
            return newProgress >= 100 ? 100 : newProgress;
          } else {
            const newProgress = prev - change;
            return newProgress <= 0 ? 0 : newProgress;
          }
        });
      }, intervalTime);
    } else {
      // Clear interval when not playing
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-500 transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});

/**
 * Displays the current question with answer options.
 * Handles answer selection and shows results when answer is revealed.
 */
function QuestionDisplay() {
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
          Question {questionNumber!}/{controller.config.questionCount}
        </h2>
        <p className="text-disabled-text">
          Select the correct song title
        </p>
      </div>

      <div className="mx-auto w-3/4">
        <ProgressBar duration={controller.ingameData.currentAudioState === "load"
            ? -controller.ingameData.currentAudioLength
            : controller.ingameData.currentAudioLength
        } isPlaying={isPlaying} />
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
            playerAnswers={controller.players}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerResults() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "answer");
  useRoomControllerMessageTypeListener(controller, "question");
  let rankedPlayers: PlayerState[] = [];

  if (controller.ingameData.currentAnswer) {
    rankedPlayers = controller.players
        .map(p => {
          // don't show time for wrong answers
          if (p.answerIndex !== controller.ingameData.currentAnswer!.correctIndex) {
            p.answerSpeed = undefined;
          }
          return p;
        })
        .sort((a, b) => {
          // 1. Handle "Correctness" (Presence of answerSpeed)
          if (a.answerSpeed !== undefined && b.answerSpeed === undefined) return -1;
          if (a.answerSpeed === undefined && b.answerSpeed !== undefined) return 1;

          // 2. Both are correct: Sort by speed (ascending)
          if (a.answerSpeed !== undefined && b.answerSpeed !== undefined) {
            return a.answerSpeed - b.answerSpeed;
          }

          // 3. Both are wrong: Keep original order (or return 0)
          return 0;
        });
  }

  if (rankedPlayers.length === 0) return null;

  return (
      <div className="space-y-6 xl:max-w-3/4 mx-auto p-4 min-h-full mt-8">
        <h2 className="text-2xl font-bold mb-2">
          Player Answers
        </h2>
        <ResultsPlayerList rankedPlayers={rankedPlayers} showField="points" showField2="answerSpeed" showRankingNumbers={false} />
      </div>
  );
}

/**
 * Main ingame component that only renders when game state is 'ingame'.
 * Displays the current question and handles answer selection.
 */
export function Ingame() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update");

  if (controller.state !== "ingame") return null;

  return (
    <div className="lg:max-w-3/4 mx-auto h-full flex items-center justify-center p-4">
      <div className="m-auto text-center max-w-full w-full lg:w-auto">
        <QuestionDisplay />
        <AnswerResults />
      </div>
    </div>
  );
}