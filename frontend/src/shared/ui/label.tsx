import type { LabelHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1 block text-xs font-semibold uppercase tracking-wide text-muted',
        className,
      )}
      {...props}
    />
  )
}
