import { useEffect, useState, useCallback } from "react";

type ToastMessage = {
  id: string;
  message: string;
};

function ToastErrorMessage({ message, id, onRemove }: { message: string; id: string; onRemove: (id: string) => void }) {
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
          type="button"
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

let toasts: ToastMessage[] = [];
const listeners: Set<() => void> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function showToastError(message: string) {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
  toasts = [...toasts, { id, message }];
  notifyListeners();
}

export function ToastError() {
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

  if (toasts.length === 0) return null;

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
