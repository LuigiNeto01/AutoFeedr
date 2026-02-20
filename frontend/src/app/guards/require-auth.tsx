import { useQuery } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { api, ApiError } from '@/shared/lib/api'
import { clearAccessToken, isAuthenticated } from '@/shared/lib/session'

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation()
  const hasToken = isAuthenticated()

  const meQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: api.me,
    enabled: hasToken,
    retry: false,
  })

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (meQuery.isLoading) {
    return <div className="p-6 text-sm text-muted">Validando sessão...</div>
  }

  if (meQuery.error) {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      clearAccessToken()
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
