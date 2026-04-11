import React, {useCallback, useEffect} from "react";
import { useModalWindow } from "react-modal-global";
import { Button } from "../components/Button";
import { Modal } from "./Modal";
import { ModalContent } from "./ModalContent";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
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
  onCancel
}: ConfirmDialogProps) {
  const modal = useModalWindow();

  const handleConfirm = useCallback(() => {
    onConfirm();
    modal.close();
  }, [modal, onConfirm]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    modal.close();
  }, [modal, onCancel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirm]);

  return (
    <ModalContent title={title}>
      <p className="text-default mb-6 whitespace-pre-line">{message}</p>
      <div className="flex flex-col gap-2">
        <Button onClick={handleConfirm} className="w-full">
          {confirmText}
        </Button>
        <Button onClick={handleCancel} defaultColors={false} className="w-full bg-disabled-text hover:bg-disabled-bg text-white">
          {cancelText}
        </Button>
      </div>
    </ModalContent>
  );
}

/**
 * Opens a confirmation dialog and returns a promise that resolves to true if confirmed, false if cancelled.
 * @param title - The dialog title
 * @param message - The confirmation message
 * @param options - Optional confirm and cancel button text
 * @returns Promise resolving to true if confirmed, false if cancelled
 */
export async function showConfirm(
  title: string,
  message: string,
  options?: {
    confirmText?: string;
    cancelText?: string;
  }
): Promise<boolean> {
  return new Promise(resolve => {
    Modal.open(ConfirmDialog, {
      title,
      message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}
