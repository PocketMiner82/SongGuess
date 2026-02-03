import { Button } from "./Button";
import {useEffect, useState} from "react";


/**
 * A modal popup component that displays fatal errors with a button to return to the main page.
 * Used for critical errors like disconnection or connection failures.
 * 
 * @returns A modal overlay with error message and back button.
 */
export function FatalErrorPopup() {
  let [error, setError] = useState("");

  // Expose the addError function globally for use throughout the app
  useEffect(() => {
    (window as any).showFatalError = (msg: string) => setError(msg);
    return () => {
      delete (window as any).showFatalError;
    };
  }, []);

  if (!error) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-card-bg rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <span className="material-icons text-error mr-3 text-2xl">error</span>
          <h2 className="text-xl font-bold text-default">Fatal Error</h2>
        </div>
        <p className="text-default mb-6 whitespace-pre-line">{error}</p>
        <Button
            onClick={() => window.location.reload()}
            className="w-full"
        >
          <span className="material-symbols-outlined mr-2">refresh</span>
          Reload page
        </Button>
        <Button
            onClick={() => window.location.href = "/"}
            className="mt-2 w-full"
        >
          <span className="material-symbols-outlined mr-2">home</span>
          Back to main page
        </Button>
      </div>
    </div>
  );
}