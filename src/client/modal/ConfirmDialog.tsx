import { useCallback, useEffect } from "react";
import { useModalWindow } from "react-modal-global";
import { Button } from "../components/Button";
import { ModalContent } from "./ModalContent";


interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
}

/**
 * A confirmation dialog component that displays a title, message, and confirm/cancel buttons.
 * Closes on confirm or cancel, and supports Enter key for quick confirmation.
 */
export function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  const modal = useModalWindow();

  const handleConfirm = useCallback(() => {
    onConfirm();
    modal.close();
  }, [modal, onConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        modal.close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm, modal]);

  return (
    <ModalContent title={title}>
      <p className="text-default mb-6 whitespace-pre-line">{message}</p>
      <div className="flex flex-col gap-2">
        <Button onClick={handleConfirm} className="w-full">
          {confirmText}
        </Button>
        <Button onClick={() => modal.close()} variant="secondary" className="w-full">
          {cancelText}
        </Button>
      </div>
    </ModalContent>
  );
}
