import type { SelectHTMLAttributes } from 'react';

import { cn } from './cn.ts';

/** Native selection field with the look of `Input`; options are `<option>` children (CU-058). */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-control w-full min-w-0 rounded-control border border-border-input bg-surface px-2',
        'text-body text-text aria-invalid:border-error disabled:bg-bg',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
