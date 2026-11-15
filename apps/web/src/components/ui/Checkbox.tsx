import { useId } from 'react';

/**
 * Native check box inside its label (CU-058). An `error` stands below it like the error text of
 * a form field (CU-057), linked with `aria-describedby`.
 */
export function Checkbox({
  label,
  checked,
  disabled,
  error,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (checked: boolean) => void;
}) {
  const errorId = `${useId()}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-body text-text">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={checked}
          disabled={disabled}
          {...(error && { 'aria-invalid': true, 'aria-describedby': errorId })}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {error && (
        <p className="flex items-start gap-1 text-label text-error">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="mt-0.5 size-3 shrink-0"
            fill="currentColor"
          >
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
          </svg>
          <span id={errorId} className="min-w-0 [overflow-wrap:anywhere]">
            {error}
          </span>
        </p>
      )}
    </div>
  );
}
