/**
 * Props for the ErrorLabel component.
 */
type ErrorLabelProps = {
  /**
   * Error message to display, or null to hide the label.
   */
  error: string | null;
};

/**
 * A component that displays error messages with an error icon.
 * 
 * @param props The error props containing the error message.
 * @returns An error message component with icon, or invisible placeholder if no error.
 */
export function ErrorLabel({ error }: ErrorLabelProps) {
  return (
    <div
      className={`flex items-center justify-center mb-2 text-sm text-error rounded-lg ${error ? "visible" : "invisible"}`}
      role="alert"
    >
      <span className="material-icons mr-1">error</span>
      <div>
        <span className="font-medium">{error}</span>
      </div>
    </div>
  );
}