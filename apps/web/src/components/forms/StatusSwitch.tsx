import { useId, type ReactNode } from 'react';

import { cn } from '../ui/cn.ts';

export interface StatusSwitchProps {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  /** Label above the switch, e.g. "Status". */
  label: ReactNode;
  /** Text beside the switch when it is on, e.g. "aktiv". */
  activeText: ReactNode;
  /** Text beside the switch when it is off, e.g. "deaktiviert". */
  inactiveText: ReactNode;
}

/**
 * Switch "Status" aktiv/deaktiviert of the maintenance lists P-01 (CU-315, addendum MAR-555,
 * FIND-324); the screen passes the texts.
 */
export function StatusSwitch({
  checked,
  disabled,
  onChange,
  label,
  activeText,
  inactiveText,
}: StatusSwitchProps) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-label font-semibold text-text">
        {label}
      </span>
      <div className="flex h-control items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border',
            'disabled:cursor-not-allowed disabled:opacity-60',
            checked ? 'border-primary bg-primary' : 'border-border-input bg-bg',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'inline-block size-5 rounded-full bg-surface shadow transition-transform',
              checked ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
        <span className="text-body">{checked ? activeText : inactiveText}</span>
      </div>
    </div>
  );
}
