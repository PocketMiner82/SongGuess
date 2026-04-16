import { memo, useCallback, useEffect, useState } from "react";


interface ToastMessage {
  id: string;
  message: string;
}

const ToastErrorMessage = memo(({ message, id, onRemove }: { message: string; id: string; onRemove: (id: string) => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [id, onRemove]);

  return (
    <div className="bg-card-bg rounded-lg shadow-lg mb-2 min-w-80 max-w-96 border-l-4 border-error relative overflow-hidden">
      <div className="flex items-center p-3">
        <span className="material-icons text-error mr-2 text-sm" aria-hidden="true">error</span>
        <p className="text-default text-sm flex-1 whitespace-pre-line leading-none wrap-anywhere">{message}</p>
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="ml-2 text-disabled-text hover:text-default transition-colors flex items-center justify-center focus-visible:ring-2 focus-visible:ring-secondary rounded"
          aria-label="Dismiss error"
        >
          <span className="material-icons text-sm leading-none" aria-hidden="true">close</span>
        </button>
      </div>
      <div className="h-1 bg-gray-500 @starting:opacity-0 animate-[progress-bar_5s_linear_forwards]" />
      <style>
        {`
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[progress-bar_5s_linear_forwards\\] {
            animation: none;
            background-color: transparent;
          }
        }
      `}
      </style>
    </div>
  );
});

let toasts: ToastMessage[] = [];
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

// TODO
// eslint-disable-next-line react-refresh/only-export-components
export function showToastError(message: string) {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
  toasts = [...toasts, { id, message }];
  notifyListeners();
}

export function ToastError() {
  // eslint-disable-next-line react/use-state
  const [, setUpdate] = useState(0);

  useEffect(() => {
    const listener = () => setUpdate(prev => prev + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    toasts = toasts.filter(toast => toast.id !== id);
    notifyListeners();
  }, []);

  if (toasts.length === 0)
    return null;

  return (
    <div className="fixed top-4 right-4 z-55 flex flex-col items-end" role="region" aria-label="Notifications" aria-live="polite">
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
