import type { ReactNode } from "react";

/**
 * Toggle switch component for advanced song filtering setting.
 * Features left-aligned label and right-aligned toggle switch.
 */
export function SettingsToggle({ value, onToggle, disabled, children }: { value: boolean; onToggle: (value: boolean) => void; disabled?: boolean; children: ReactNode }) {
  const label = children?.toString() || "this setting";
  return (
    <div className="flex items-center justify-between">
      <span className={disabled ? "text-disabled-text" : ""}>
        {children}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
          value ? "bg-secondary" : "bg-gray-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-label={`${value ? "Disable" : "Enable"} ${label}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
