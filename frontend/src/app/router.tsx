import { createBrowserRouter, Navigate } from 'react-router-dom'

import { AppShell } from '@/app/layout/app-shell'
import { AccountsPage } from '@/features/accounts/page'
import { AutomationsPage } from '@/features/automations/page'
import { DashboardPage } from '@/features/dashboard/page'
import { ExecutionsPage } from '@/features/executions/page'
import { RunNowPage } from '@/features/run-now/page'
import { SchedulesPage } from '@/features/schedules/page'
import { ResultsPage } from '@/features/results/page'
import { SettingsPage } from '@/features/settings/page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/contas', element: <AccountsPage /> },
      { path: '/automacoes', element: <AutomationsPage /> },
      { path: '/execucoes', element: <ExecutionsPage /> },
      { path: '/executar-agora', element: <RunNowPage /> },
      { path: '/agendamentos', element: <SchedulesPage /> },
      { path: '/resultados', element: <ResultsPage /> },
      { path: '/configuracoes', element: <SettingsPage /> },
    ],
  },
])
