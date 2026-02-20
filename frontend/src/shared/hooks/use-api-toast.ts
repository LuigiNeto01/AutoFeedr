import { toast } from 'sonner'

import { ApiError } from '@/shared/lib/api'

export function useApiToast() {
  return {
    showError(error: unknown, fallback = 'Erro inesperado na operação.') {
      if (error instanceof ApiError) {
        toast.error(`HTTP ${error.status}: ${error.detail}`)
        return
      }

      if (error instanceof Error) {
        toast.error(error.message)
        return
      }

      toast.error(fallback)
    },
    showSuccess(message: string) {
      toast.success(message)
    },
  }
}
