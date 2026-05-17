import type { ReactNode } from "react";

/**
 * Toggle switch component for advanced song filtering setting.
 * Features left-aligned label and right-aligned toggle switch.
 */
export function SettingsToggle({ value, onToggle, children }: { value: boolean; onToggle: (value: boolean) => void; children: ReactNode }) {
  const label = children?.toString() || "this setting";
  return (
    <div className="flex items-center justify-between">
      <span>
        {children}
      </span>
      <button
        type="button"
        onClick={() => onToggle(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
          value ? "bg-secondary" : "bg-gray-300"
        }`}
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
