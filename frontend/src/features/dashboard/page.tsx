import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Link } from 'react-router-dom'

import { toUnifiedLeetcodeJobs, toUnifiedLinkedinJobs, sortByMostRecent } from '@/entities/adapters'
import type { JobStatus, UnifiedExecution } from '@/entities/types'
import { PageHeader } from '@/widgets/page-header'
import { KpiCard } from '@/widgets/kpi-card'
import { StatusBadge } from '@/widgets/status-badge'
import { api } from '@/shared/lib/api'
import { formatDateTime } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'

const statusList: JobStatus[] = ['pending', 'running', 'retry', 'failed', 'success']

export function DashboardPage() {
  const linkedinJobsQuery = useQuery({
    queryKey: ['linkedin-jobs', 120],
    queryFn: () => api.linkedinJobs(120),
    refetchInterval: 15_000,
  })
  const leetcodeJobsQuery = useQuery({
    queryKey: ['leetcode-jobs', 120],
    queryFn: () => api.leetcodeJobs({ limit: 120 }),
    refetchInterval: 15_000,
  })
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
  })
  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })

  const allExecutions = useMemo(() => {
    const linkedin = toUnifiedLinkedinJobs(linkedinJobsQuery.data ?? [], accountsQuery.data ?? [])
    const leetcode = toUnifiedLeetcodeJobs(
      leetcodeJobsQuery.data ?? [],
      repositoriesQuery.data ?? [],
    )
    return sortByMostRecent([...linkedin, ...leetcode])
  }, [accountsQuery.data, leetcodeJobsQuery.data, linkedinJobsQuery.data, repositoriesQuery.data])

  const last24h = useMemo(() => {
    const now = Date.now()
    const threshold = now - 24 * 60 * 60 * 1000
    return allExecutions.filter((execution) => new Date(execution.createdAt).getTime() >= threshold)
  }, [allExecutions])

  const counters = useMemo(() => {
    const base: Record<JobStatus, number> = {
      pending: 0,
      running: 0,
      retry: 0,
      failed: 0,
      success: 0,
    }
    for (const execution of last24h) {
      base[execution.status] += 1
    }
    return base
  }, [last24h])

  const trendData = useMemo(() => buildTrendData(last24h), [last24h])
  const latest = allExecutions.slice(0, 8)

  return (
    <div>
      <PageHeader
        title="Painel Operacional"
        description="Visão consolidada de execução do AutoFeedr nas últimas 24h"
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link to="/execucoes">Abrir execução detalhada</Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statusList.map((status) => (
          <KpiCard
            key={status}
            label={status.toUpperCase()}
            value={counters[status]}
            hint="Últimas 24h"
          />
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardTitle>Tendência por status</CardTitle>
          <CardDescription className="mb-4">Janela de 24h em blocos de 4 horas</CardDescription>
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5f" />
                <XAxis dataKey="bucket" stroke="#8ea3c9" />
                <YAxis allowDecimals={false} stroke="#8ea3c9" />
                <Tooltip
                  contentStyle={{
                    background: '#0f1627',
                    border: '1px solid #2a3a5f',
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: '#dce7ff' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="pending"
                  stackId="1"
                  stroke="#1cb4c8"
                  fill="#1cb4c8"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="running"
                  stackId="1"
                  stroke="#1f6feb"
                  fill="#1f6feb"
                  fillOpacity={0.18}
                />
                <Area
                  type="monotone"
                  dataKey="retry"
                  stackId="1"
                  stroke="#d59724"
                  fill="#d59724"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stackId="1"
                  stroke="#d14c63"
                  fill="#d14c63"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="success"
                  stackId="1"
                  stroke="#13a96d"
                  fill="#13a96d"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Saúde do sistema</CardTitle>
          <CardDescription className="mb-4">Status da API e ingestão de dados</CardDescription>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-panel/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">API</p>
              <p className="mt-1 font-mono text-sm text-slate-100">
                {healthQuery.data?.service ?? 'autofeedr-api'}
              </p>
              <p className="mt-2 text-sm">
                Status:{' '}
                {healthQuery.data?.status === 'ok' ? (
                  <span className="text-success">online</span>
                ) : (
                  <span className="text-danger">offline</span>
                )}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-panel/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Fila ativa</p>
              <p className="mt-1 text-sm text-slate-100">
                {counters.pending + counters.running + counters.retry} jobs em andamento/retry
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-panel/70 p-3">
              <p className="text-xs uppercase tracking-wide text-muted">Taxa de sucesso</p>
              <p className="mt-1 text-sm text-slate-100">
                {last24h.length ? Math.round((counters.success / last24h.length) * 100) : 0}% nas
                últimas 24h
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <CardTitle>Últimas execuções</CardTitle>
              <CardDescription>Quick action para abrir detalhes em tempo real</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/execucoes">Ver tudo</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {latest.length ? (
              latest.map((item) => (
                <div
                  key={`${item.source}-${item.id}`}
                  className="grid gap-2 rounded-xl border border-border/70 bg-panel/60 p-3 md:grid-cols-[9rem_1fr_9rem_11rem_7rem] md:items-center"
                >
                  <p className="text-xs uppercase tracking-wide text-muted">
                    {item.source === 'linkedin_post' ? 'linkedin_post' : 'leetcode_commit'}
                  </p>
                  <p className="truncate text-sm text-slate-100" title={item.title}>
                    {item.title}
                  </p>
                  <StatusBadge status={item.status} />
                  <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/execucoes?source=${item.source}&id=${item.id}`}>Detalhes</Link>
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Ainda sem execuções registradas.</p>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}

function buildTrendData(executions: UnifiedExecution[]) {
  const now = Date.now()
  const slots = Array.from({ length: 6 }, (_, index) => {
    const start = now - (5 - index) * 4 * 60 * 60 * 1000
    return {
      label: new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      start,
      end: start + 4 * 60 * 60 * 1000,
      pending: 0,
      running: 0,
      retry: 0,
      failed: 0,
      success: 0,
    }
  })

  for (const execution of executions) {
    const createdAt = new Date(execution.createdAt).getTime()
    const slot = slots.find((item) => createdAt >= item.start && createdAt < item.end)
    if (slot) slot[execution.status] += 1
  }

  return slots.map(({ label, pending, running, retry, failed, success }) => ({
    bucket: label,
    pending,
    running,
    retry,
    failed,
    success,
  }))
}
