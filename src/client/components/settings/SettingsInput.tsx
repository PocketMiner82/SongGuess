import type { ReactNode } from "react";
import { useState } from "react";
import * as React from "react";

/**
 * Number input component for settings with validation.
 * Features left-aligned label and right-aligned number input.
 */
export function SettingsNumberInput({ value, onChange, min, max, disabled, children }: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [inputValue, setInputValue] = useState(value.toString());
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setInputValue(value.toString());
    setPrevValue(value);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const numValue = Number.parseInt(newValue, 10);
    if (!Number.isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = Number.parseInt(inputValue, 10);
    if (Number.isNaN(numValue) || numValue < min || numValue > max) {
      setInputValue(value.toString());
    }
  };

  const label = children?.toString() || "value";
  return (
    <div className="flex items-center justify-between">
      <span className={disabled ? "text-disabled-text" : ""}>
        {children}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={inputValue}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-label={label}
        className={`w-11 px-2 text-center border-b-2 border-gray-500 focus:border-secondary outline-0 focus:outline-0 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </div>
  );
}
