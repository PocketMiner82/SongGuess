import { Button } from "../../../../components/Button";
import { useControllerContext, useRoomControllerMessageTypeListener } from "../../../RoomController";

/**
 * Host-only component to start the game. Shows validation errors
 * and handles the start game confirmation from the server.
 */
export function StartGame() {
  const controller = useControllerContext();
  useRoomControllerMessageTypeListener(controller, "update_playlists");

  return (
    <Button
      disabled={controller.playlists.length === 0 && controller.config.gameMode === "multiple_choice"}
      onClick={() => controller.startGame()}
    >
      Start Game
    </Button>
  );
}
