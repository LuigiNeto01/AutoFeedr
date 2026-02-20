import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 w-full rounded-xl border border-border/80 bg-panel/80 px-3 text-sm text-slate-100 outline-none transition-all focus:border-accent/60 focus:ring-2 focus:ring-accent/30',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
