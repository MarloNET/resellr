import { useCallback, useEffect, useId, useState, type ReactNode, type RefObject } from 'react';

/** Attributes the field passes to its control (`Input`, select, text area). */
export interface FormFieldControlProps {
  id: string;
  'aria-required'?: true;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

export interface FormFieldProps {
  label: string;
  /** Required field: "*" after the label (DESIGN.md "Formulare"). */
  required?: boolean;
  /** Error text of the field (`fields[].message` or the Zod check in the browser). */
  error?: string;
  children: (control: FormFieldControlProps) => ReactNode;
}

/**
 * Form field (CU-057, design chapter 5 "Validierung", DESIGN.md "Formulare"): label above the
 * control, "*" for required fields, the error text below the control in error with a symbol,
 * linked to the control with `aria-describedby`.
 */
export function FormField({ label, required = false, error, children }: FormFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-label font-semibold text-text">
        {label}
        {required && <span aria-hidden="true">*</span>}
      </label>
      {children({
        id,
        ...(required && { 'aria-required': true }),
        ...(error && { 'aria-invalid': true, 'aria-describedby': errorId }),
      })}
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

/**
 * Focus on the first faulty field (design chapter 5, Technical Specification 2.0.7
 * `.validation`): the returned function moves the focus to the first control marked invalid in
 * the container after the next render, so the screen can call it right after setting the errors.
 */
export function useFocusFirstError(containerRef: RefObject<HTMLElement | null>): () => void {
  const [request, setRequest] = useState(0);

  useEffect(() => {
    if (request === 0) return;
    containerRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [request, containerRef]);

  return useCallback(() => setRequest((count) => count + 1), []);
}
