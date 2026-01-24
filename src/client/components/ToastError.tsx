import { useEffect, useState, useCallback } from "react";

/**
 * Props for the ToastError component.
 */
type ToastErrorProps = {
  /**
   * Error message to display.
   */
  message: string;
  /**
   * Unique identifier for this toast message.
   */
  id: string;
  /**
   * Callback function to remove this toast after it expires.
   */
  onRemove: (id: string) => void;
};

/**
 * Individual toast error message component that appears in the top-right corner.
 * Automatically disappears after 5 seconds.
 * 
 * @param props The toast error props.
 * @returns A toast message with error icon and auto-dismiss functionality.
 */
function ToastErrorMessage({ message, id, onRemove }: ToastErrorProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onRemove]);

  return (
    <div className="bg-card-bg rounded-lg shadow-lg mb-2 min-w-80 max-w-96 border-l-4 border-error relative overflow-hidden">
      <div className="flex items-center p-3">
        <span className="material-icons text-error mr-2 text-sm">error</span>
        <p className="text-default text-sm flex-1 whitespace-pre-line leading-none wrap-anywhere">{message}</p>
        <button
          onClick={() => onRemove(id)}
          className="ml-2 text-disabled-text hover:text-default transition-colors flex items-center justify-center"
          aria-label="Dismiss error"
        >
          <span className="material-icons text-sm leading-none">close</span>
        </button>
      </div>
      <div className="h-1 bg-gray-500 animate-[progress-bar_5s_linear_forwards]" />
    </div>
  );
}

/**
 * Toast error container that manages multiple error messages in the top-right corner.
 * Messages stack vertically and automatically dismiss after 5 seconds.
 */
export function ToastError() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);

  /**
   * Adds a new error message to the toast container.
   * 
   * @param message The error message to display.
   */
  const addError = useCallback((message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    setToasts(prev => [...prev, { id, message }]);
  }, []);

  /**
   * Removes a toast message by its ID.
   * 
   * @param id The ID of the toast to remove.
   */
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Expose the addError function globally for use throughout the app
  useEffect(() => {
    (window as any).showToastError = addError;
    return () => {
      delete (window as any).showToastError;
    };
  }, [addError]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      {toasts.map(toast => (
        <ToastErrorMessage
          key={toast.id}
          message={toast.message}
          id={toast.id}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
}