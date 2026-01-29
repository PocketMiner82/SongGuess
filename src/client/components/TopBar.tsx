import { type ReactNode } from 'react';
import { version } from "../../../package.json";

/**
 * Props for the TopBar component.
 */
type TopBarProps = {
  /**
   * Additional elements to render on the right side of the top bar.
   * These can be positioned independently of the centered "SongGuess" text.
   */
  children?: ReactNode;
  
  /**
   * Additional CSS classes to apply to the top bar.
   */
  className?: string;
};

/**
 * A top navigation bar component with centered "SongGuess" title that redirects to home.
 * Allows for additional elements to be positioned independently on the right side.
 * 
 * @param props The top bar props including children elements and styling options.
 * @returns A styled top bar element.
 */
export function TopBar({
  children,
  className = ''
}: TopBarProps) {
  return (
    <div className={`font-sans bg-default-bg border-b border-gray-300 dark:border-gray-700 z-50 ${className}`}>
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex-1">
          v{version}
        </div>

        <a
          href="/"
          className="flex-1 text-center cursor-pointer"
        >
          <span className="text-2xl font-bold text-default">SongGuess</span>
        </a>

        <div className="flex-1 flex justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}