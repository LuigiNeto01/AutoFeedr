import type { JobStatus } from '@/entities/types'
import { statusLabel, statusVariant } from '@/shared/constants/status'
import { Badge } from '@/shared/ui/badge'

export function StatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={statusVariant[status]}>{statusLabel[status]}</Badge>
}
