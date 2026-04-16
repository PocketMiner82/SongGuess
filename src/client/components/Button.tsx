import type { ReactNode } from "react";

/**
 * Button variant styles for different visual appearances.
 * - `primary`: Primary action button with filled background
 * - `secondary`: Secondary action button with outlined background
 * - `plain`: Minimal button with no background styling
 */
export type ButtonVariant = "primary" | "secondary" | "plain";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "text-white bg-primary hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled-text",
  secondary: "bg-secondary hover:bg-secondary-hover text-white disabled:opacity-50",
  plain: "focus-visible:ring-2 focus-visible:ring-secondary",
};

/**
 * Props for the Button component.
 */
interface ButtonProps {
  /** Click handler for the button */
  onClick?: () => void;
  /** Tooltip text displayed on hover */
  title?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes to apply */
  className?: string;
  /** Visual style variant of the button */
  variant?: ButtonVariant;
  /** HTML button type attribute */
  type?: "button" | "submit" | "reset";
  /** Button content */
  children: ReactNode;
}

/**
 * A customizable button component with multiple variants.
 * Supports primary, secondary, and plain styling with disabled state.
 *
 * @example
 * ```tsx
 * <Button onClick={handleClick}>Click me</Button>
 * <Button variant="secondary" disabled>Disabled</Button>
 * ```
 */
export function Button({
  onClick,
  title,
  disabled = false,
  className = "",
  variant = "primary",
  type = "button",
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${variantClasses[variant]} rounded disabled:cursor-not-allowed
        cursor-pointer font-bold text-lg py-2 px-4 ${className}`}
      onClick={onClick}
      title={title}
    >
      <div className="flex items-center text-center justify-center">
        {children}
      </div>
    </button>
  );
}
