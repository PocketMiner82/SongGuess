import { useCallback } from "react";
import { useModalWindow } from "react-modal-global";
import { Button } from "../components/Button";
import { UsernameInputField } from "../room/components/UsernameInputField";
import { useControllerContext } from "../room/RoomController";


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

  const handleJoin = useCallback((username?: string) => {
    if (username) {
      controller.reconnect(username);
    } else {
      const nameInput = document.querySelector<HTMLInputElement>("#username-input");
      controller.reconnect(nameInput?.value ?? "", true);
    }
    modal.close();
    onComplete();
  }, [controller, modal, onComplete]);

  return (
    <div className="bg-card-bg rounded-lg p-6 max-w-md mx-4 shadow-xl w-full">
      <h2 className="text-xl font-bold text-default mb-6">
        Room
        {controller.roomID}
      </h2>
      <p className="text-default mb-2">Please choose your username:</p>

      <div className="mb-2">
        <UsernameInputField onEnd={name => handleJoin(name)} requireEnter={true} showButton={true} />
      </div>

      <div className="mb-4 w-full">
        <Button className="w-full bg-secondary hover:bg-secondary-hover" onClick={() => handleJoin()}>
          Join as Spectator
        </Button>
      </div>

      <p className="text-sm text-disabled-text">Tip: You can later click on your username to change it.</p>
    </div>
  );
}
