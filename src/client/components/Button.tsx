import { type ReactNode } from 'react';

type ButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  defaultColors?: boolean;
  children: ReactNode;
};

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
      {children}
    </button>
  );
}
