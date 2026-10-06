import { GamePhase } from "../../../../../shared/game/GamePhase";
import { useControllerContext } from "../../../hooks/RoomControllerHooks";
import {
  useRoomControllerMessageTypeListener,
} from "../../../hooks/RoomControllerListenerHooks";
import { PlayerPickingDisplay } from "./PlayerPickingDisplay";
import { PlayerPicksAnsweringDisplay } from "./PlayerPicksAnsweringDisplay";


export function PlayerPicksQuestionDisplay() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "round_state");

  const roundMsg = controller.questionData.roundMsg;
  const isPickingPhase = roundMsg?.gamePhase === GamePhase.PICKING;
  const isMyQuestion = roundMsg?.question?.questionType === "player_picks"
    ? controller.uuid === roundMsg?.question?.pickerId
    : false;

  const pickingMessage = isPickingPhase
    ? "Select a song for others to guess"
    : (isMyQuestion ? "This is your question" : "Type the song title you hear");

  return (
    <div className="xl:flex-2 space-y-6 w-full flex items-center justify-center">
      <div className="flex flex-col gap-2 w-full lg:w-3xl 2xl:w-5xl">
        <h3 className="text-lg text-center font-bold">
          {pickingMessage}
        </h3>
        {isPickingPhase
          ? <PlayerPickingDisplay />
          : <PlayerPicksAnsweringDisplay />}
      </div>
    </div>
  );
}
