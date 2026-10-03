import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { useRoomControllerMessageTypeListener } from "../../hooks/RoomControllerListenerHooks";
import { MultipleChoiceQuestionDisplay } from "./MultipleChoiceQuestionDisplay";
import { PlayerPicksQuestionDisplay } from "./PlayerPicksQuestionDisplay";

/**
 * Main ingame component that only renders when game state is 'ingame'.
 * Displays the current question and handles answer selection.
 */
export function Ingame() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "room_state");

  if (controller.state !== "ingame")
    return null;

  if (!controller.questionData.roundMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full">
        <div className="material-symbols-outlined animate-spin text-gray-500 mb-8" role="img" aria-label="Loading">
          progress_activity
        </div>
        <div className="text-2xl">Loading game…</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col xl:flex-row-reverse justify-center items-center gap-8">
      {
        controller.config.gameMode === "multiple_choice"
          ? <MultipleChoiceQuestionDisplay />
          : <PlayerPicksQuestionDisplay />
      }
    </div>
  );
}
