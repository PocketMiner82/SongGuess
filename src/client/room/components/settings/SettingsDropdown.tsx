import type { ReactNode } from "react";

/**
 * Dropdown select component for settings with predefined options.
 * Features left-aligned label and right-aligned dropdown.
 */
export function SettingsDropdown({ value, onChange, options, children }: {
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  children: ReactNode;
}) {
  const label = children?.toString() || "option";
  return (
    <div className="flex items-center justify-between">
      <span>
        {children}
      </span>
      <select
        value={value}
        onChange={e => onChange(Number.parseInt(e.target.value, 10))}
        aria-label={label}
        className="px-2 py-1 border-b-2 border-gray-500 focus:border-secondary outline-0 focus:outline-0 focus-visible:ring-2 focus-visible:ring-secondary bg-transparent"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
