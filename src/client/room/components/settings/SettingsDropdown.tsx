import type { ReactNode } from "react";

/**
 * Dropdown select component for settings with predefined options.
 * Features left-aligned label and right-aligned dropdown.
 */
export function SettingsDropdown({ value, onChange, options, disabled, children }: {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  disabled?: boolean;
  children: ReactNode;
}) {
  const label = children?.toString() || "option";
  return (
    <div className="flex items-center justify-between">
      <span className={disabled ? "text-disabled-text" : ""}>
        {children}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number.parseInt(e.target.value, 10))}
        aria-label={label}
        className={`px-2 py-1 border-b-2 border-gray-500 focus:border-secondary outline-0 focus:outline-0 focus-visible:ring-2 focus-visible:ring-secondary bg-transparent ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="text-default bg-card-bg">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
