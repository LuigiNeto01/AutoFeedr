import type { HTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-xl bg-panel/90', className)} {...props} />
}
