import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "./Modal";

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
  },
): Promise<boolean> {
  return new Promise((resolve) => {
    let isConfirmed = false;
    Modal.open(ConfirmDialog, {
      title,
      message,
      confirmText: options?.confirmText,
      cancelText: options?.cancelText,
      onConfirm: () => isConfirmed = true,
    }).on("close", () => {
      resolve(isConfirmed);
    });
  });
}
