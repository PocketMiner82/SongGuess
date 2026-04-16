import React, { useMemo } from "react";
import {useControllerContext, useRoomControllerMessageTypeListener} from "../../RoomController";
import {ResultsPlayerList} from "../ResultsPlayerList";
import {MultipleChoiceQuestionDisplay} from "./MultipleChoiceQuestionDisplay";
import {PlayerPicksQuestionDisplay} from "./PlayerPicksQuestionDisplay";

function AnswerResults() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "answer");
  useRoomControllerMessageTypeListener(controller, "question");

  const rankedPlayers = useMemo(() => {
    if (!controller.ingameData.currentAnswer) return [];
    
    return [...controller.playerMessages]
        .sort((a, b) => {
          if (a.answerData && b.answerData) {
            return a.answerData.answerSpeed - b.answerData.answerSpeed;
          }
          return 0;
        }).sort((a, b) => {
          if (a.answerData?.roundPoints && !b.answerData?.roundPoints) return -1;
          if (!a.answerData?.roundPoints && b.answerData?.roundPoints) return 1;
          return 0;
        });
  }, [controller.playerMessages, controller.ingameData.currentAnswer]);

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
        {
          controller.config.gameMode === "multiple_choice"
              ? <MultipleChoiceQuestionDisplay />
              : <PlayerPicksQuestionDisplay />
        }
        <AnswerResults />
      </div>
    </div>
  );
}