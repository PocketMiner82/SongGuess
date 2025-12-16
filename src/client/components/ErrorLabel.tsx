type ErrorLabelProps = {
  error: string | null;
};

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