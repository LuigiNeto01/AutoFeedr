import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { AutomationKind, LeetCodeSchedule, LinkedinSchedule } from '@/entities/types'
import { difficultyPolicies, selectionStrategies, weekDays } from '@/shared/constants/options'
import { api } from '@/shared/lib/api'
import { formatDateTime } from '@/shared/lib/utils'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { PageHeader } from '@/widgets/page-header'

const linkedinUpdateSchema = z.object({
  topic: z.string().min(2),
  cron_expr: z.string().optional(),
  day_of_week: z.number().min(0).max(6).nullable(),
  time_local: z.string().optional(),
  timezone: z.string().min(2),
  is_active: z.boolean(),
})

const leetcodeUpdateSchema = z.object({
  cron_expr: z.string().optional(),
  day_of_week: z.number().min(0).max(6).nullable(),
  time_local: z.string().optional(),
  timezone: z.string().min(2),
  selection_strategy: z.string().optional(),
  difficulty_policy: z.string().optional(),
  max_attempts: z.number().min(1).max(10),
  is_active: z.boolean(),
})

type AutomationRecord = {
  id: number
  kind: AutomationKind
  name: string
  destination: string
  status: boolean
  frequency: string
  updatedAt: string
  raw: LinkedinSchedule | LeetCodeSchedule
}

export function AutomationsPage() {
  const queryClient = useQueryClient()
  const toast = useApiToast()

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

  const [selected, setSelected] = useState<AutomationRecord | null>(null)

  const automations = useMemo(() => {
    const accountById = new Map((accountsQuery.data ?? []).map((item) => [item.id, item.name]))
    const repoById = new Map(
      (repositoriesQuery.data ?? []).map((item) => [item.id, item.repo_ssh_url]),
    )

    const linkedinRows: AutomationRecord[] = (linkedinSchedulesQuery.data ?? []).map((item) => ({
      id: item.id,
      kind: 'linkedin_post',
      name: item.topic,
      destination: accountById.get(item.account_id) ?? `Conta #${item.account_id}`,
      status: item.is_active,
      frequency: item.cron_expr,
      updatedAt: item.updated_at,
      raw: item,
    }))

    const leetcodeRows: AutomationRecord[] = (leetcodeSchedulesQuery.data ?? []).map((item) => ({
      id: item.id,
      kind: 'leetcode_commit',
      name: `LeetCode schedule #${item.id}`,
      destination: repoById.get(item.repository_id) ?? `Repo #${item.repository_id}`,
      status: item.is_active,
      frequency: item.cron_expr,
      updatedAt: item.updated_at,
      raw: item,
    }))

    return [...linkedinRows, ...leetcodeRows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [
    accountsQuery.data,
    leetcodeSchedulesQuery.data,
    linkedinSchedulesQuery.data,
    repositoriesQuery.data,
  ])

  const updateLinkedinMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: z.infer<typeof linkedinUpdateSchema> }) =>
      api.updateLinkedinSchedule(id, payload),
    onSuccess: () => {
      toast.showSuccess('Automação LinkedIn atualizada.')
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['linkedin-schedules'] })
    },
    onError: (error) => toast.showError(error),
  })

  const updateLeetcodeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: z.infer<typeof leetcodeUpdateSchema> }) =>
      api.updateLeetcodeSchedule(id, payload),
    onSuccess: () => {
      toast.showSuccess('Automação LeetCode atualizada.')
      setSelected(null)
      queryClient.invalidateQueries({ queryKey: ['leetcode-schedules'] })
    },
    onError: (error) => toast.showError(error),
  })

  return (
    <div>
      <PageHeader
        title="Automações"
        description="Catálogo unificado de rotinas configuradas no AutoFeedr."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {automations.map((item) => (
          <Card key={`${item.kind}-${item.id}`}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{item.name}</CardTitle>
                <CardDescription className="mt-1 break-all">{item.destination}</CardDescription>
              </div>
              <Badge variant={item.status ? 'success' : 'danger'}>
                {item.status ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            <div className="space-y-1 text-xs text-muted">
              <p>Tipo: {item.kind}</p>
              <p>Frequência: {item.frequency}</p>
              <p>Atualizada: {formatDateTime(item.updatedAt)}</p>
            </div>
            <Button
              className="mt-4 w-full"
              size="sm"
              variant="outline"
              onClick={() => setSelected(item)}
            >
              Editar no painel lateral
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.kind === 'linkedin_post'
                ? 'Editar automação LinkedIn'
                : 'Editar automação LeetCode'}
            </DialogTitle>
          </DialogHeader>

          {selected?.kind === 'linkedin_post' ? (
            <LinkedinAutomationEditor
              schedule={selected.raw as LinkedinSchedule}
              onSubmit={(payload) => updateLinkedinMutation.mutate({ id: selected.id, payload })}
              loading={updateLinkedinMutation.isPending}
            />
          ) : selected ? (
            <LeetcodeAutomationEditor
              schedule={selected.raw as LeetCodeSchedule}
              onSubmit={(payload) => updateLeetcodeMutation.mutate({ id: selected.id, payload })}
              loading={updateLeetcodeMutation.isPending}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LinkedinAutomationEditor({
  schedule,
  onSubmit,
  loading,
}: {
  schedule: LinkedinSchedule
  onSubmit: (payload: z.infer<typeof linkedinUpdateSchema>) => void
  loading: boolean
}) {
  const form = useForm<z.infer<typeof linkedinUpdateSchema>>({
    resolver: zodResolver(linkedinUpdateSchema),
    defaultValues: {
      topic: schedule.topic,
      cron_expr: schedule.cron_expr,
      day_of_week: schedule.day_of_week ?? null,
      time_local: schedule.time_local ?? '',
      timezone: schedule.timezone,
      is_active: schedule.is_active,
    },
  })

  useEffect(() => {
    form.reset({
      topic: schedule.topic,
      cron_expr: schedule.cron_expr,
      day_of_week: schedule.day_of_week ?? null,
      time_local: schedule.time_local ?? '',
      timezone: schedule.timezone,
      is_active: schedule.is_active,
    })
  }, [form, schedule])

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <Label htmlFor="auto-li-topic">Topic</Label>
        <Input id="auto-li-topic" {...form.register('topic')} />
      </div>
      <div>
        <Label htmlFor="auto-li-cron">Cron expression</Label>
        <Input id="auto-li-cron" placeholder="0 9 * * 1" {...form.register('cron_expr')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="auto-li-day">Dia da semana</Label>
          <Select
            id="auto-li-day"
            value={String(form.watch('day_of_week') ?? '')}
            onChange={(event) =>
              form.setValue('day_of_week', event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">-</option>
            {weekDays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="auto-li-time">Hora local</Label>
          <Input id="auto-li-time" placeholder="09:00" {...form.register('time_local')} />
        </div>
      </div>
      <div>
        <Label htmlFor="auto-li-timezone">Timezone</Label>
        <Input id="auto-li-timezone" {...form.register('timezone')} />
      </div>
      <Switch
        checked={form.watch('is_active')}
        onChange={(event) => form.setValue('is_active', event.currentTarget.checked)}
        label="Automação ativa"
      />
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}

function LeetcodeAutomationEditor({
  schedule,
  onSubmit,
  loading,
}: {
  schedule: LeetCodeSchedule
  onSubmit: (payload: z.infer<typeof leetcodeUpdateSchema>) => void
  loading: boolean
}) {
  const form = useForm<z.infer<typeof leetcodeUpdateSchema>>({
    resolver: zodResolver(leetcodeUpdateSchema),
    defaultValues: {
      cron_expr: schedule.cron_expr,
      day_of_week: schedule.day_of_week ?? null,
      time_local: schedule.time_local ?? '',
      timezone: schedule.timezone,
      selection_strategy: schedule.selection_strategy ?? 'random',
      difficulty_policy: schedule.difficulty_policy ?? 'free_any',
      max_attempts: schedule.max_attempts,
      is_active: schedule.is_active,
    },
  })

  useEffect(() => {
    form.reset({
      cron_expr: schedule.cron_expr,
      day_of_week: schedule.day_of_week ?? null,
      time_local: schedule.time_local ?? '',
      timezone: schedule.timezone,
      selection_strategy: schedule.selection_strategy ?? 'random',
      difficulty_policy: schedule.difficulty_policy ?? 'free_any',
      max_attempts: schedule.max_attempts,
      is_active: schedule.is_active,
    })
  }, [form, schedule])

  return (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <Label htmlFor="auto-lc-cron">Cron expression</Label>
        <Input id="auto-lc-cron" placeholder="0 9 * * 1" {...form.register('cron_expr')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="auto-lc-day">Dia da semana</Label>
          <Select
            id="auto-lc-day"
            value={String(form.watch('day_of_week') ?? '')}
            onChange={(event) =>
              form.setValue('day_of_week', event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">-</option>
            {weekDays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="auto-lc-time">Hora local</Label>
          <Input id="auto-lc-time" placeholder="09:00" {...form.register('time_local')} />
        </div>
      </div>
      <div>
        <Label htmlFor="auto-lc-tz">Timezone</Label>
        <Input id="auto-lc-tz" {...form.register('timezone')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="auto-lc-strategy">Selection strategy</Label>
          <Select id="auto-lc-strategy" {...form.register('selection_strategy')}>
            {selectionStrategies.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="auto-lc-policy">Difficulty policy</Label>
          <Select id="auto-lc-policy" {...form.register('difficulty_policy')}>
            {difficultyPolicies.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="auto-lc-max">Max attempts</Label>
        <Input
          id="auto-lc-max"
          type="number"
          min={1}
          max={10}
          {...form.register('max_attempts', { valueAsNumber: true })}
        />
      </div>
      <Switch
        checked={form.watch('is_active')}
        onChange={(event) => form.setValue('is_active', event.currentTarget.checked)}
        label="Automação ativa"
      />
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? 'Salvando...' : 'Salvar'}
      </Button>
    </form>
  )
}
