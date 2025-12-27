import { type ReactNode } from 'react';

type ButtonProps = {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function Button({
  onClick,
  disabled = false,
  className = '',
  children
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`text-white bg-primary rounded hover:bg-primary-hover
        disabled:bg-disabled-bg disabled:text-disabled-text disabled:cursor-not-allowed
        cursor-pointer font-bold text-lg py-2 px-4 ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
