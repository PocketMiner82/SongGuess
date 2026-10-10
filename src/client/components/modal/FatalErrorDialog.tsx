import { useCallback } from "react";
import { Button } from "../Button";
import { ModalContent } from "./ModalContent";


interface FatalErrorDialogProps {
  error: string;
  forceGet?: boolean;
}

/**
 * A fatal error dialog that displays an error message with options to reload the page
 * or return to the main page. Used for unrecoverable errors.
 */
export function FatalErrorDialog({ error, forceGet }: FatalErrorDialogProps) {
  const reloadWindow = useCallback(() => {
    try {
      // @ts-expect-error - reload(forceGet) is deprecated but still works
      window.location.reload(forceGet);
    } catch {
      window.location.reload();
    }
  }, [forceGet]);

  return (
    <ModalContent title="Fatal Error" iconName="error" iconColor="text-error">
      <p className="text-default mb-6 whitespace-pre-line">{error}</p>
      <div className="flex flex-col gap-2">
        <Button onClick={() => reloadWindow()} className="w-full">
          <span className="material-symbols-outlined mr-2">refresh</span>
          Reload page
        </Button>
        <Button onClick={() => window.location.href = "/"} variant="secondary" className="w-full">
          <span className="material-symbols-outlined mr-2">home</span>
          Back to main page
        </Button>
      </div>
    </ModalContent>
  );
}
