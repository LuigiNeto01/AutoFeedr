import type { HTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export function Separator({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-border/70', className)} {...props} />
}
