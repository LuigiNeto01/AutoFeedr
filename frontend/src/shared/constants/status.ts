import type { JobStatus } from '@/entities/types'

export const statusLabel: Record<JobStatus, string> = {
  pending: 'Pendente',
  running: 'Executando',
  retry: 'Retry',
  success: 'Sucesso',
  failed: 'Falhou',
}

export const statusVariant: Record<
  JobStatus,
  'pending' | 'running' | 'warning' | 'success' | 'danger'
> = {
  pending: 'pending',
  running: 'running',
  retry: 'warning',
  success: 'success',
  failed: 'danger',
}
