import { useId, type ReactNode } from 'react';

/** Native radio buttons in a fieldset; the arrow keys choose without own code (CU-058). */
export function RadioGroup({
  legend,
  value,
  options,
  disabled,
  onChange,
}: {
  legend: string;
  value: string;
  options: { value: string; label: ReactNode }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const name = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
      <legend className="mb-1 p-0 text-label font-semibold text-text">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-2 text-body text-text">
          <input
            type="radio"
            name={name}
            className="size-4 accent-primary"
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
