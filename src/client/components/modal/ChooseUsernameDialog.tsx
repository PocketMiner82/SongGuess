import { useCallback } from "react";
import { useModalWindow } from "react-modal-global";
import { useControllerContext } from "../../hooks/RoomControllerHooks";
import { UsernameInputField } from "../player/UsernameInputField";


interface ChooseUsernameContentProps {
  onComplete: () => void;
}

/**
 * A dialog for choosing a username to join a room.
 * Allows users to enter a custom username or join as a spectator.
 */
export function ChooseUsernameDialog({ onComplete }: ChooseUsernameContentProps) {
  const modal = useModalWindow();
  const controller = useControllerContext();

  const handleJoin = useCallback(() => {
    modal.close();
    onComplete();
  }, [modal, onComplete]);

  return (
    <div className="bg-card-bg rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
      <h2 className="text-xl font-bold text-default mb-6">
        Room
        {" "}
        {controller.roomID}
      </h2>
      <p className="text-default mb-2">Please choose your username:</p>

      <div className="mb-4">
        <UsernameInputField
          onEnd={(name, spectator) => {
            controller.reconnect(name, spectator);
            handleJoin();
          }}
          requireEnter={true}
          showButtons={true}
        />
      </div>

      <p className="text-sm text-disabled-text">Tip: You can later click on your username to change it.</p>
    </div>
  );
}
