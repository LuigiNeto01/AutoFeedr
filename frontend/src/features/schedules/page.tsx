import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { AutomationKind } from '@/entities/types'
import { difficultyPolicies, selectionStrategies, weekDays } from '@/shared/constants/options'
import { api } from '@/shared/lib/api'
import { formatDateTime } from '@/shared/lib/utils'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { PageHeader } from '@/widgets/page-header'

const linkedinScheduleSchema = z.object({
  account_id: z.number().min(1),
  topic: z.string().min(2),
  cron_expr: z.string().optional(),
  day_of_week: z.number().min(0).max(6).optional(),
  time_local: z.string().optional(),
  timezone: z.string().min(2),
  source_mode: z.string().default('arxiv'),
  is_active: z.boolean(),
})

const leetcodeScheduleSchema = z.object({
  repository_id: z.number().min(1),
  cron_expr: z.string().optional(),
  day_of_week: z.number().min(0).max(6).optional(),
  time_local: z.string().optional(),
  timezone: z.string().min(2),
  selection_strategy: z.string().optional(),
  difficulty_policy: z.string().optional(),
  max_attempts: z.number().min(1).max(10),
  is_active: z.boolean(),
})

type LinkedinScheduleForm = z.input<typeof linkedinScheduleSchema>
type LeetcodeScheduleForm = z.input<typeof leetcodeScheduleSchema>

export function SchedulesPage() {
  const toast = useApiToast()
  const queryClient = useQueryClient()

  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })
  const linkedinSchedulesQuery = useQuery({
    queryKey: ['linkedin-schedules'],
    queryFn: api.linkedinSchedules,
  })
  const leetcodeSchedulesQuery = useQuery({
    queryKey: ['leetcode-schedules'],
    queryFn: api.leetcodeSchedules,
  })

  const linkedinForm = useForm<LinkedinScheduleForm>({
    resolver: zodResolver(linkedinScheduleSchema),
    defaultValues: {
      account_id: 0,
      timezone: 'America/Sao_Paulo',
      source_mode: 'arxiv',
      is_active: true,
    },
  })

  const leetcodeForm = useForm<LeetcodeScheduleForm>({
    resolver: zodResolver(leetcodeScheduleSchema),
    defaultValues: {
      repository_id: 0,
      timezone: 'America/Sao_Paulo',
      selection_strategy: 'random',
      difficulty_policy: 'free_any',
      max_attempts: 5,
      is_active: true,
    },
  })

  const createLinkedinMutation = useMutation({
    mutationFn: api.createLinkedinSchedule,
    onSuccess: () => {
      toast.showSuccess('Agendamento LinkedIn criado.')
      linkedinForm.reset({
        account_id: 0,
        topic: '',
        cron_expr: '',
        day_of_week: undefined,
        time_local: '',
        timezone: 'America/Sao_Paulo',
        source_mode: 'arxiv',
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['linkedin-schedules'] })
    },
    onError: (error) => toast.showError(error),
  })

  const createLeetcodeMutation = useMutation({
    mutationFn: api.createLeetcodeSchedule,
    onSuccess: () => {
      toast.showSuccess('Agendamento LeetCode criado.')
      leetcodeForm.reset({
        repository_id: 0,
        cron_expr: '',
        day_of_week: undefined,
        time_local: '',
        timezone: 'America/Sao_Paulo',
        selection_strategy: 'random',
        difficulty_policy: 'free_any',
        max_attempts: 5,
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['leetcode-schedules'] })
    },
    onError: (error) => toast.showError(error),
  })

  const toggleMutation = useMutation({
    mutationFn: async ({
      kind,
      id,
      isActive,
    }: {
      kind: AutomationKind
      id: number
      isActive: boolean
    }) => {
      if (kind === 'linkedin_post') {
        return api.updateLinkedinSchedule(id, { is_active: isActive })
      }
      return api.updateLeetcodeSchedule(id, { is_active: isActive })
    },
    onSuccess: (_, variables) => {
      toast.showSuccess('Status do agendamento atualizado.')
      queryClient.invalidateQueries({
        queryKey: [
          variables.kind === 'linkedin_post' ? 'linkedin-schedules' : 'leetcode-schedules',
        ],
      })
    },
    onError: (error) => toast.showError(error),
  })

  const unifiedRows = useMemo(() => {
    const accountsById = new Map((accountsQuery.data ?? []).map((item) => [item.id, item.name]))
    const reposById = new Map(
      (repositoriesQuery.data ?? []).map((item) => [item.id, item.repo_ssh_url]),
    )

    const li = (linkedinSchedulesQuery.data ?? []).map((item) => ({
      id: item.id,
      kind: 'linkedin_post' as const,
      destination: accountsById.get(item.account_id) ?? `Conta #${item.account_id}`,
      frequency: item.cron_expr,
      timezone: item.timezone,
      retries: '-',
      isActive: item.is_active,
      updatedAt: item.updated_at,
    }))

    const lc = (leetcodeSchedulesQuery.data ?? []).map((item) => ({
      id: item.id,
      kind: 'leetcode_commit' as const,
      destination: reposById.get(item.repository_id) ?? `Repo #${item.repository_id}`,
      frequency: item.cron_expr,
      timezone: item.timezone,
      retries: String(item.max_attempts),
      isActive: item.is_active,
      updatedAt: item.updated_at,
    }))

    return [...li, ...lc].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [
    accountsQuery.data,
    leetcodeSchedulesQuery.data,
    linkedinSchedulesQuery.data,
    repositoriesQuery.data,
  ])

  return (
    <div>
      <PageHeader
        title="Agendamentos"
        description="Crie e monitore schedules unificados com timezone e estratégia de retry."
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardTitle>Schedules ativos</CardTitle>
          <CardDescription className="mb-4">Visão de calendário/lista operacional.</CardDescription>
          <div className="space-y-2">
            {unifiedRows.map((row) => (
              <div
                key={`${row.kind}-${row.id}`}
                className="rounded-xl border border-border/70 bg-panel/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted">
                      {row.kind} #{row.id}
                    </p>
                    <p className="text-sm text-slate-100 break-all">{row.destination}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.isActive ? 'success' : 'danger'}>
                      {row.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Switch
                      checked={row.isActive}
                      onChange={(event) =>
                        toggleMutation.mutate({
                          kind: row.kind,
                          id: row.id,
                          isActive: event.currentTarget.checked,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted md:grid-cols-4">
                  <p>Frequência: {row.frequency}</p>
                  <p>Timezone: {row.timezone}</p>
                  <p>Retries: {row.retries}</p>
                  <p>Atualizado: {formatDateTime(row.updatedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Novo agendamento</CardTitle>
          <CardDescription className="mb-4">
            Escolha o fluxo e preencha a programação.
          </CardDescription>

          <Tabs defaultValue="linkedin">
            <TabsList>
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              <TabsTrigger value="leetcode">LeetCode</TabsTrigger>
            </TabsList>

            <TabsContent value="linkedin">
              <form
                className="space-y-3"
                onSubmit={linkedinForm.handleSubmit((values) =>
                  createLinkedinMutation.mutate(values),
                )}
              >
                <div>
                  <Label htmlFor="sch-li-account">Conta</Label>
                  <Select
                    id="sch-li-account"
                    value={String(linkedinForm.watch('account_id') ?? '')}
                    onChange={(event) =>
                      linkedinForm.setValue(
                        'account_id',
                        event.target.value ? Number(event.target.value) : 0,
                      )
                    }
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sch-li-topic">Topic</Label>
                  <Input id="sch-li-topic" {...linkedinForm.register('topic')} />
                </div>
                <div>
                  <Label htmlFor="sch-li-cron">Cron expression</Label>
                  <Input
                    id="sch-li-cron"
                    placeholder="0 9 * * 1"
                    {...linkedinForm.register('cron_expr')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sch-li-day">Dia da semana</Label>
                    <Select
                      id="sch-li-day"
                      value={String(linkedinForm.watch('day_of_week') ?? '')}
                      onChange={(event) =>
                        linkedinForm.setValue(
                          'day_of_week',
                          event.target.value ? Number(event.target.value) : undefined,
                        )
                      }
                    >
                      <option value="">-</option>
                      {weekDays.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sch-li-time">Hora local</Label>
                    <Input
                      id="sch-li-time"
                      placeholder="09:00"
                      {...linkedinForm.register('time_local')}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sch-li-timezone">Timezone</Label>
                  <Input id="sch-li-timezone" {...linkedinForm.register('timezone')} />
                </div>
                <Switch
                  checked={linkedinForm.watch('is_active')}
                  onChange={(event) =>
                    linkedinForm.setValue('is_active', event.currentTarget.checked)
                  }
                  label="Ativo"
                />
                <Button
                  className="w-full"
                  disabled={createLinkedinMutation.isPending}
                  type="submit"
                >
                  {createLinkedinMutation.isPending ? 'Criando...' : 'Criar schedule LinkedIn'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="leetcode">
              <form
                className="space-y-3"
                onSubmit={leetcodeForm.handleSubmit((values) =>
                  createLeetcodeMutation.mutate(values),
                )}
              >
                <div>
                  <Label htmlFor="sch-lc-repo">Repositório</Label>
                  <Select
                    id="sch-lc-repo"
                    value={String(leetcodeForm.watch('repository_id') ?? '')}
                    onChange={(event) =>
                      leetcodeForm.setValue(
                        'repository_id',
                        event.target.value ? Number(event.target.value) : 0,
                      )
                    }
                  >
                    <option value="">Selecione</option>
                    {(repositoriesQuery.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.repo_ssh_url}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sch-lc-cron">Cron expression</Label>
                  <Input
                    id="sch-lc-cron"
                    placeholder="0 9 * * 1"
                    {...leetcodeForm.register('cron_expr')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sch-lc-day">Dia da semana</Label>
                    <Select
                      id="sch-lc-day"
                      value={String(leetcodeForm.watch('day_of_week') ?? '')}
                      onChange={(event) =>
                        leetcodeForm.setValue(
                          'day_of_week',
                          event.target.value ? Number(event.target.value) : undefined,
                        )
                      }
                    >
                      <option value="">-</option>
                      {weekDays.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sch-lc-time">Hora local</Label>
                    <Input
                      id="sch-lc-time"
                      placeholder="09:00"
                      {...leetcodeForm.register('time_local')}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sch-lc-timezone">Timezone</Label>
                  <Input id="sch-lc-timezone" {...leetcodeForm.register('timezone')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sch-lc-strategy">Selection strategy</Label>
                    <Select id="sch-lc-strategy" {...leetcodeForm.register('selection_strategy')}>
                      {selectionStrategies.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="sch-lc-policy">Difficulty policy</Label>
                    <Select id="sch-lc-policy" {...leetcodeForm.register('difficulty_policy')}>
                      {difficultyPolicies.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sch-lc-max">Max attempts</Label>
                  <Input
                    id="sch-lc-max"
                    type="number"
                    min={1}
                    max={10}
                    {...leetcodeForm.register('max_attempts', { valueAsNumber: true })}
                  />
                </div>
                <Switch
                  checked={leetcodeForm.watch('is_active')}
                  onChange={(event) =>
                    leetcodeForm.setValue('is_active', event.currentTarget.checked)
                  }
                  label="Ativo"
                />
                <Button
                  className="w-full"
                  disabled={createLeetcodeMutation.isPending}
                  type="submit"
                >
                  {createLeetcodeMutation.isPending ? 'Criando...' : 'Criar schedule LeetCode'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
