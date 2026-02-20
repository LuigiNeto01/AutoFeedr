import type { InputHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export function Switch({ className, label, checked, ...props }: SwitchProps) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 text-sm text-slate-200',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition',
          checked ? 'bg-accent/80' : 'bg-border',
        )}
      >
        <input className="peer sr-only" type="checkbox" checked={checked} {...props} />
        <span
          className={cn(
            'absolute left-1 h-4 w-4 rounded-full bg-white transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
      {label ? <span>{label}</span> : null}
    </label>
  )
}
