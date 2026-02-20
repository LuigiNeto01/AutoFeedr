import * as React from 'react'

import { cn } from '@/shared/lib/utils'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'min-h-24 w-full rounded-xl border border-border/80 bg-panel/80 px-3 py-2 text-sm text-slate-100 outline-none transition-all placeholder:text-muted focus:border-accent/60 focus:ring-2 focus:ring-accent/30',
      className,
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
