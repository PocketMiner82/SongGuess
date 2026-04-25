import { useMemo } from "react";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { ResultsPlayerList } from "../ResultsPlayerList";
import { MultipleChoiceQuestionDisplay } from "./MultipleChoiceQuestionDisplay";
import { PlayerPicksQuestionDisplay } from "./PlayerPicksQuestionDisplay";
import { QuestionHeader } from "./QuestionHeader";


function AnswerResults() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "answer");
  useRoomControllerMessageTypeListener(controller, "question");

  const rankedPlayers = useMemo(() => {
    if (!controller.roundData.currentAnswer)
      return [];

    return [...controller.playerMessages]
      .sort((a, b) => {
        if (a.answerData && b.answerData) {
          return a.answerData.answerSpeed - b.answerData.answerSpeed;
        }
        return 0;
      })
      .sort((a, b) => {
        if (a.answerData?.roundPoints && !b.answerData?.roundPoints)
          return -1;
        if (!a.answerData?.roundPoints && b.answerData?.roundPoints)
          return 1;
        return 0;
      });
  }, [controller.playerMessages, controller.roundData.currentAnswer]);

  if (rankedPlayers.length === 0)
    return null;

  return (
    <div className="space-y-6 xl:max-w-3/4 mx-auto p-4 min-h-full mt-8 text-center">
      <h3 className="text-lg font-bold">
        Player Answers
      </h3>
      <ResultsPlayerList
        rankedPlayers={rankedPlayers}
        showField="points"
        showField2="answerSpeed"
        showField3={controller.config.gameMode !== "multiple_choice" ? "answer" : undefined}
        showRankingNumbers={false}
      />
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

  if (controller.state !== "ingame")
    return null;

  if (!controller.roundData.currentQuestion && !controller.roundData.currentAnswer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full">
        <div className="material-symbols-outlined animate-spin text-gray-500 mb-8" role="img" aria-label="Loading">
          progress_activity
        </div>
        <div className="text-2xl">Loading question…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full">
      <QuestionHeader />
      <div className="flex-1 mx-auto w-full flex justify-center p-4">
        <div className="m-auto w-full lg:w-auto">
          {
            controller.config.gameMode === "multiple_choice"
              ? <MultipleChoiceQuestionDisplay />
              : <PlayerPicksQuestionDisplay />
          }
          <AnswerResults />
        </div>
      </div>
    </div>
  );
}
