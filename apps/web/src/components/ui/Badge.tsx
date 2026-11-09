import type { HTMLAttributes } from 'react';

import { cn } from './cn.ts';

/** Text chip for channel status and flags, radius 4 px (DESIGN.md "Chips/Badges"). */
export type BadgeVariant = 'draft' | 'approved' | 'published' | 'warn' | 'error';

const VARIANTS: Record<BadgeVariant, string> = {
  draft: 'bg-status-draft-bg text-status-draft',
  approved: 'bg-status-approved-bg text-status-approved',
  published: 'bg-status-published-bg text-status-published',
  warn: 'bg-flag-warn-bg text-flag-warn',
  error: 'bg-error-bg text-error',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
}

export function Badge({ variant, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-chip px-2 text-label',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
