import { type ReactNode } from 'react';

/**
 * Props for the BottomBar component.
 */
type BottomBarProps = {
  /**
   * Additional elements to render on the right side of the bottom bar.
   * These can be positioned independently of the audio controls.
   */
  children?: ReactNode;
  
  /**
   * Additional CSS classes to apply to the bottom bar.
   */
  className?: string;
};

/**
 * Bottom bar component for the game room that contains audio controls.
 * Displays audio controls on the left and allows additional elements to be positioned independently on the right side.
 */
export function BottomBar({
  children,
  className = ''
}: BottomBarProps) {
  return (
    <div className={`bg-default-bg border-t border-gray-300 dark:border-gray-700 z-50 ${className}`}>
      <div className="flex items-center justify-between h-16 px-4">
        {children}
      </div>
    </div>
  );
}