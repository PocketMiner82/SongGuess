import { type ReactNode } from 'react';

/**
 * Props for the Button component.
 */
type ButtonProps = {
  /**
   * Click event handler for the button.
   */
  onClick?: () => void;
  
  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;
  
  /**
   * Additional CSS classes to apply to the button.
   */
  className?: string;
  
  /**
   * Whether to use default button colors (primary theme colors).
   */
  defaultColors?: boolean;
  
  /**
   * Content to render inside the button.
   */
  children: ReactNode;
};

/**
 * A reusable button component with customizable styling and behavior.
 * 
 * @param props The button props including onClick handler, disabled state, and styling options.
 * @returns A styled button element.
 */
export function Button({
  onClick,
  disabled = false,
  className = '',
  defaultColors = true,
  children
}: ButtonProps) {
  let colorClasses = "";
  if (defaultColors) {
    colorClasses = "text-white bg-primary hover:bg-primary-hover " +
        "disabled:bg-disabled-bg disabled:text-disabled-text";
  }

  return (
    <button
      disabled={disabled}
      className={`${colorClasses} rounded disabled:cursor-not-allowed
        cursor-pointer font-bold text-lg py-2 px-4 ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center text-center justify-center">
        {children}
      </div>
    </button>
  );
}
