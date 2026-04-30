import { useControllerContext, useRoomControllerMessageTypeListener } from "../../RoomController";
import { ProgressBar } from "./ProgressBar";

/**
 * Displays the question number and progress bar.
 * - Default (large screens): compact floating card below the topbar.
 * - Small screens (sm/md): full-width bar connected to the TopBar.
 * Used by both game modes to show consistent question progress.
 */
export function QuestionHeader() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "round_state");

  const roundNumber = controller.questionData.roundMsg?.roundCurrent;
  const questionString = controller.questionData.roundMsg?.question?.questionType === "player_picks"
    ? `${controller.questionData.roundMsg.question.questionCurrent}/${controller.questionData.roundMsg.question.questionCount}`
    : undefined;

  if (roundNumber === undefined || controller.state !== "ingame") {
    return null;
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 p-3 px-6 bg-default-bg border-b border-gray-300
      dark:border-gray-700 mx-auto w-full lg:w-1/3 lg:border-l lg:border-r lg:rounded-b-2xl mb-2"
      >
        <h2 className="text-xl font-bold whitespace-nowrap">
          Round
          {" "}
          {roundNumber}
          /
          {controller.config.roundsCount}
        </h2>
        {questionString
          ? (
              <h3 className="text-lg whitespace-nowrap">
                Question
                {" "}
                {questionString}
              </h3>
            )
          : undefined}
        <div className="w-full">
          <ProgressBar />
        </div>
      </div>
    </>
  );
}
