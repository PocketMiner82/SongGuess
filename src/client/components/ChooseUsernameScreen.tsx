import { useEffect } from "react";
import { Modal } from "../Modal";
import { ChooseUsernameDialog } from "./modal/ChooseUsernameDialog";

/**
 * Screen component displayed when a user needs to choose a username before joining the room.
 *
 * @param onChoose - Callback function called after the user successfully chooses a username
 * @constructor
 */
export function ChooseUsernameScreen({ onChoose }: { onChoose: () => void }) {
  useEffect(() => {
    Modal.open(ChooseUsernameDialog, { onComplete: onChoose, closable: false }).then();
  }, [onChoose]);

  return <div className="h-full w-full"></div>;
}
