import type { ReactNode } from "react";
import React from "react";
import { useModalWindow } from "react-modal-global";

/**
 * Props for the ModalContent component.
 */
interface ModalContentProps {
  /** Optional title displayed at the top of the modal */
  title?: string;
  /** Optional Material Icons name to display next to the title */
  iconName?: string;
  /** CSS color class for the icon */
  iconColor?: string;
  /** Modal body content */
  children: ReactNode;
  /** Maximum width constraint for the modal */
  maxWidth?: "sm" | "md" | "lg" | "full";
}

/**
 * The content wrapper for modal dialogs.
 * Provides consistent styling with optional title, icon, and max-width constraints.
 * Closes on Escape key when closable param is set.
 */
export function ModalContent({ title, iconName, iconColor = "text-default", children, maxWidth = "md" }: ModalContentProps) {
  const modal = useModalWindow();
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    full: "lg:w-[60vw] lg:min-w-md",
  };

  React.useEffect(() => {
    if (!modal.params.closable)
      return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        modal.close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modal]);

  return (
    <div className={`bg-card-bg rounded-lg p-6 shadow-xl ${maxWidthClasses[maxWidth]} mx-4 w-full relative max-h-[85vh] overflow-y-auto overscroll-contain`}>
      {modal.params.closable && (
        <button
          type="button"
          onClick={() => modal.close()}
          className="text-default hover:text-primary transition-colors cursor-pointer p-1 absolute top-4 right-4 focus-visible:ring-2 focus-visible:ring-secondary rounded"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
        </button>
      )}
      {(title || iconName) && (
        <div className="flex items-center gap-3 mb-4">
          {iconName && (
            <span className={`material-icons text-2xl ${iconColor}`} aria-hidden="true">{iconName}</span>
          )}
          {title && (
            <h2 className="text-xl font-bold text-default">{title}</h2>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
