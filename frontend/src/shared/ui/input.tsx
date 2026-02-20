import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    className={cn(
      'h-10 w-full rounded-xl border border-border/80 bg-panel/80 px-3 text-sm text-slate-100 outline-none transition-all placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30',
      className,
    )}
    ref={ref}
    {...props}
  />
))
Input.displayName = 'Input'
