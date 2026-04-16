import { type ReactNode } from 'react';

/**
 * Button variant styles.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'plain';

const variantClasses: Record<ButtonVariant, string> = {
  primary: "text-white bg-primary hover:bg-primary-hover disabled:bg-disabled-bg disabled:text-disabled-text",
  secondary: "bg-disabled-text hover:bg-disabled-bg text-white disabled:opacity-50",
  plain: "",
};

type ButtonProps = {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  children: ReactNode;
};

export function Button({
  onClick,
  title,
  disabled = false,
  className = '',
  variant = 'primary',
  type = 'button',
  children
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
