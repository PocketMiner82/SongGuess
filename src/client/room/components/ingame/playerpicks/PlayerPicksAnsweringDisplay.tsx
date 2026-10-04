import { useCallback, useEffect, useState } from "react";
import { GamePhase } from "../../../../../shared/game/GamePhase";
import { Button } from "../../../../components/Button";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import {
  useRoomControllerListener,
  useRoomControllerMessageTypeListener,
} from "../../../hooks/RoomControllerListenerHooks";
import { PlaylistCard } from "../../PlaylistCard";


export function PlayerPicksAnsweringDisplay() {
  const controller = useControllerContext();
  const [answer, setAnswer] = useState(controller.questionData.selectedAnswer ?? "");
  const [inputDisabled, setInputDisabled] = useState(false);

  const roundMsg = controller.questionData.roundMsg;
  const correctSong = roundMsg?.question?.questionType === "player_picks"
    ? roundMsg?.question?.correctAnswer
    : undefined;
  const answerInputEnabled = roundMsg?.gamePhase === GamePhase.ANSWERING || roundMsg?.gamePhase === GamePhase.QUESTION;
  const isMyQuestion = controller.checkCurrentQuestionIsByUUID(controller.uuid);

  const handleSelect = useCallback(() => {
    if (roundMsg?.gamePhase !== GamePhase.ANSWERING || !answer.trim() || answer === controller.questionData.selectedAnswer || isMyQuestion) {
      return;
    }

    controller.selectAnswerText(answer.trim());
  }, [answer, controller, isMyQuestion, roundMsg?.gamePhase]);

  useRoomControllerMessageTypeListener(controller, "round_state", (msg) => {
    handleSelect();

    if (msg.gamePhase === GamePhase.QUESTION) {
      setAnswer(controller.questionData.selectedAnswer ?? "");
      setInputDisabled(false);
    }
  });

  useRoomControllerListener(controller, useCallback((msg) => {
    return msg?.type === "confirmation" && msg.sourceMessage.type === "select_answer";
  }, []));

  useEffect(() => {
    if (answer) {
      handleSelect();
    }
  }, [answer, handleSelect]);

  return (
    <>
      { isMyQuestion
        ? (
            <div className="text-disabled-text text-center">
              Please wait for the other players to guess!
            </div>
          )
        : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSelect();
                setInputDisabled(true);
              }}
              className="mt-8 w-full"
            >
              <div className="flex gap-2 justify-center">
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Enter song name…"
                  disabled={inputDisabled || !answerInputEnabled}
                  className="flex-1 max-w-md px-4 py-2 bg-card-bg border border-gray-500 rounded focus:border-secondary outline-0 disabled:opacity-50"
                  autoFocus
                />
                <Button disabled={inputDisabled || !answer.trim() || !answerInputEnabled} type="submit">
                  Submit
                </Button>
              </div>
              {inputDisabled && (
                <div className="text-center text-disabled-text mt-2">
                  <p>Answer submitted!</p>
                  <p
                    className="text-primary underline hover:cursor-pointer"
                    onClick={() => setInputDisabled(false)}
                  >
                    Edit answer
                  </p>
                </div>
              )}
            </form>
          )}

      {correctSong && (
        <div className="mt-4">
          <PlaylistCard
            title={correctSong.name}
            subtitle={correctSong.artist}
            coverURL={correctSong.cover}
            hrefURL={correctSong.hrefURL}
          />
        </div>
      )}
    </>
  );
}
