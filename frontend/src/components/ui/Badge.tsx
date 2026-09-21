import React from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'fresh' | 'ok' | 'soon' | 'overdue' | 'active' | 'consumed' | 'discarded' | 'neutral' | 'owner' | 'manager' | 'member';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'neutral', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    // Expiry tones
    fresh:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    ok:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    soon:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    overdue:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-semibold',

    // Batch status
    active:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    consumed:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    discarded:
      'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700 line-through',

    // Household roles
    owner:
      'bg-[#2d6a4f]/10 text-[#2d6a4f] border-[#2d6a4f]/20 dark:bg-[#2d6a4f]/30 dark:text-emerald-300 dark:border-[#2d6a4f]/50 font-semibold',
    manager:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 font-semibold',
    member:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',

    // Generic
    neutral:
      'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap select-none transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {variant === 'fresh' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
      {variant === 'soon' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />}
      {variant === 'overdue' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
      {children}
    </span>
  );
}
