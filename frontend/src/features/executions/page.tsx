import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { useSearchParams } from 'react-router-dom'

import { toUnifiedLeetcodeJobs, toUnifiedLinkedinJobs, sortByMostRecent } from '@/entities/adapters'
import type { AutomationKind, JobStatus, UnifiedExecution } from '@/entities/types'
import { api } from '@/shared/lib/api'
import { formatDateTime, shortSha } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/shared/ui/table'
import { PageHeader } from '@/widgets/page-header'
import { StatusBadge } from '@/widgets/status-badge'

const columnHelper = createColumnHelper<UnifiedExecution>()

const columns = [
  columnHelper.accessor('source', {
    header: 'Tipo',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('title', {
    header: 'Execução',
    cell: (info) => <span className="line-clamp-1">{info.getValue()}</span>,
  }),
  columnHelper.accessor('ownerLabel', {
    header: 'Conta/Repositório',
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('attempts', {
    header: 'Tentativas',
    cell: (info) => `${info.getValue()}/${info.row.original.maxAttempts}`,
  }),
  columnHelper.accessor('createdAt', {
    header: 'Criado em',
    cell: (info) => formatDateTime(info.getValue()),
  }),
]

export function ExecutionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sourceFromQuery = searchParams.get('source') as AutomationKind | null
  const idFromQuery = Number(searchParams.get('id') || 0)

  const [typeFilter, setTypeFilter] = useState<'all' | AutomationKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all')
  const [periodFilter, setPeriodFilter] = useState<'24h' | '7d' | '30d' | 'all'>('all')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [selected, setSelected] = useState<{ source: AutomationKind; id: number } | null>(
    sourceFromQuery && idFromQuery ? { source: sourceFromQuery, id: idFromQuery } : null,
  )

  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })
  const linkedinJobsQuery = useQuery({
    queryKey: ['linkedin-jobs', 200],
    queryFn: () => api.linkedinJobs(200),
    refetchInterval: 5_000,
  })
  const leetcodeJobsQuery = useQuery({
    queryKey: ['leetcode-jobs', 200],
    queryFn: () => api.leetcodeJobs({ limit: 200 }),
    refetchInterval: 5_000,
  })

  const executionList = useMemo(() => {
    const linkedin = toUnifiedLinkedinJobs(linkedinJobsQuery.data ?? [], accountsQuery.data ?? [])
    const leetcode = toUnifiedLeetcodeJobs(
      leetcodeJobsQuery.data ?? [],
      repositoriesQuery.data ?? [],
    )
    return sortByMostRecent([...linkedin, ...leetcode])
  }, [accountsQuery.data, leetcodeJobsQuery.data, linkedinJobsQuery.data, repositoriesQuery.data])

  const filteredExecutions = useMemo(() => {
    const now = Date.now()
    const periodThreshold =
      periodFilter === '24h'
        ? now - 24 * 60 * 60 * 1000
        : periodFilter === '7d'
          ? now - 7 * 24 * 60 * 60 * 1000
          : periodFilter === '30d'
            ? now - 30 * 24 * 60 * 60 * 1000
            : null

    return executionList.filter((item) => {
      const sourceOk = typeFilter === 'all' ? true : item.source === typeFilter
      const statusOk = statusFilter === 'all' ? true : item.status === statusFilter
      const ownerOk = ownerFilter
        ? item.ownerLabel.toLowerCase().includes(ownerFilter.toLowerCase())
        : true
      const periodOk = periodThreshold
        ? new Date(item.createdAt).getTime() >= periodThreshold
        : true
      return sourceOk && statusOk && ownerOk && periodOk
    })
  }, [executionList, typeFilter, statusFilter, ownerFilter, periodFilter])

  const table = useReactTable({
    data: filteredExecutions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedExecution = selected
    ? executionList.find((item) => item.source === selected.source && item.id === selected.id)
    : null

  const leetcodeDetailQuery = useQuery({
    queryKey: ['leetcode-job', selected?.id],
    queryFn: () => api.leetcodeJob(selected!.id),
    enabled: Boolean(selected && selected.source === 'leetcode_commit'),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && ['pending', 'running', 'retry'].includes(status) ? 4000 : false
    },
  })

  const leetcodeLogsQuery = useQuery({
    queryKey: ['leetcode-job-logs', selected?.id],
    queryFn: () => api.leetcodeLogs(selected!.id, 200),
    enabled: Boolean(selected && selected.source === 'leetcode_commit'),
    refetchInterval: (query) => {
      const lastLevel = query.state.data?.at(-1)?.level
      if (lastLevel === 'error') return false
      return selected && selected.source === 'leetcode_commit' ? 4000 : false
    },
  })

  return (
    <div>
      <PageHeader
        title="Execuções"
        description="Tabela operacional com filtros, monitoramento de status e logs em tempo real."
      />

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
          <div>
            <Label htmlFor="filter-type">Tipo</Label>
            <Select
              id="filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | AutomationKind)}
            >
              <option value="all">Todos</option>
              <option value="linkedin_post">linkedin_post</option>
              <option value="leetcode_commit">leetcode_commit</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | JobStatus)}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="running">Executando</option>
              <option value="retry">Retry</option>
              <option value="failed">Falhou</option>
              <option value="success">Sucesso</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-period">Período</Label>
            <Select
              id="filter-period"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as '24h' | '7d' | '30d' | 'all')}
            >
              <option value="all">Tudo</option>
              <option value="24h">Últimas 24h</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-owner">Conta/Repositório</Label>
            <Input
              id="filter-owner"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              placeholder="Buscar..."
            />
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setSearchParams({})
                setSelected(null)
                setOwnerFilter('')
                setTypeFilter('all')
                setStatusFilter('all')
                setPeriodFilter('all')
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Fila de execuções</CardTitle>
        <CardDescription className="mb-4">
          Clique em uma linha para abrir o painel de detalhe.
        </CardDescription>

        <TableContainer>
          <Table>
            <TableHead>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeaderCell key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHeaderCell>
                  ))}
                  <TableHeaderCell>Ações</TableHeaderCell>
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const item = row.original
                        setSelected({ source: item.source, id: item.id })
                        setSearchParams({ source: item.source, id: String(item.id) })
                      }}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog
        open={Boolean(selectedExecution)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setSearchParams({})
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedExecution?.source} #{selectedExecution?.id}
            </DialogTitle>
          </DialogHeader>

          {selectedExecution ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-panel/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <StatusBadge status={selectedExecution.status} />
                  <p className="text-xs text-muted">
                    Criado em {formatDateTime(selectedExecution.createdAt)}
                  </p>
                </div>
                <p className="text-sm text-slate-100">{selectedExecution.title}</p>
                <p className="text-xs text-muted">Destino: {selectedExecution.ownerLabel}</p>
                <p className="text-xs text-muted">
                  Tentativas: {selectedExecution.attempts}/{selectedExecution.maxAttempts}
                </p>
                {selectedExecution.errorMessage ? (
                  <p className="mt-2 text-sm text-danger">Erro: {selectedExecution.errorMessage}</p>
                ) : null}
              </div>

              {selectedExecution.source === 'leetcode_commit' ? (
                <>
                  <div className="rounded-xl border border-border/70 bg-panel/70 p-3 text-xs text-muted">
                    <p>Question ID: {leetcodeDetailQuery.data?.problem_frontend_id ?? '-'}</p>
                    <p>Slug: {leetcodeDetailQuery.data?.problem_slug ?? '-'}</p>
                    <p>Dificuldade: {leetcodeDetailQuery.data?.problem_difficulty ?? '-'}</p>
                    <p>Commit SHA: {shortSha(leetcodeDetailQuery.data?.commit_sha)}</p>
                    {leetcodeDetailQuery.data?.commit_url ? (
                      <a
                        className="text-accent hover:underline"
                        href={leetcodeDetailQuery.data.commit_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Abrir commit
                      </a>
                    ) : null}
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted">
                      Logs (polling)
                    </p>
                    <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-panel/70 p-3 font-mono text-xs">
                      {(leetcodeLogsQuery.data ?? []).map((line) => (
                        <p
                          key={line.id}
                          className={line.level === 'error' ? 'text-danger' : 'text-slate-200'}
                        >
                          [{line.level}] {line.message}
                        </p>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border/70 bg-panel/70 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted">
                    Conteúdo publicado
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-100">
                    {selectedExecution.generatedPost || '-'}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
