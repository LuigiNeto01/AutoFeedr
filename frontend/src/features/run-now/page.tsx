import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'

import type { AutomationKind, LeetCodeJob, LinkedinJob } from '@/entities/types'
import { difficultyPolicies, selectionStrategies } from '@/shared/constants/options'
import { api } from '@/shared/lib/api'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { PageHeader } from '@/widgets/page-header'
import { StatusBadge } from '@/widgets/status-badge'

const runSchema = z
  .object({
    flow: z.enum(['linkedin_post', 'leetcode_commit']),
    account_id: z.number().optional(),
    topic: z.string().optional(),
    paper_url: z.string().optional(),
    paper_text: z.string().optional(),
    repository_id: z.number().optional(),
    selection_strategy: z.string().optional(),
    difficulty_policy: z.string().optional(),
    problem_slug: z.string().optional(),
    max_attempts: z.number().min(1).max(10).optional(),
  })
  .superRefine((value, context) => {
    if (value.flow === 'linkedin_post') {
      if (!value.account_id) {
        context.addIssue({
          code: 'custom',
          path: ['account_id'],
          message: 'Selecione uma conta LinkedIn.',
        })
      }
      if (!value.topic && !value.paper_url && !value.paper_text) {
        context.addIssue({
          code: 'custom',
          path: ['topic'],
          message: 'Informe topic, paper_url ou paper_text.',
        })
      }
    }

    if (value.flow === 'leetcode_commit' && !value.repository_id) {
      context.addIssue({
        code: 'custom',
        path: ['repository_id'],
        message: 'Selecione um repositório GitHub.',
      })
    }
  })

type RunForm = z.input<typeof runSchema>

type TriggerResult =
  | { flow: AutomationKind; job: LinkedinJob }
  | { flow: AutomationKind; job: LeetCodeJob }

export function RunNowPage() {
  const toast = useApiToast()

  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })

  const form = useForm<RunForm>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      flow: 'linkedin_post',
      selection_strategy: 'random',
      difficulty_policy: 'free_any',
      max_attempts: 5,
    },
  })

  const mutation = useMutation<TriggerResult, unknown, RunForm>({
    mutationFn: async (values) => {
      if (values.flow === 'linkedin_post') {
        const payload = {
          account_id: values.account_id,
          topic: values.topic?.trim() || undefined,
          paper_url: values.paper_url?.trim() || undefined,
          paper_text: values.paper_text?.trim() || undefined,
        }
        const job = await api.runLinkedinNow(payload)
        return { flow: values.flow, job }
      }

      const payload = {
        repository_id: values.repository_id,
        selection_strategy: values.selection_strategy || undefined,
        difficulty_policy: values.difficulty_policy || undefined,
        problem_slug: values.problem_slug?.trim() || undefined,
        max_attempts: values.max_attempts,
      }
      const job = await api.runLeetcodeNow(payload)
      return { flow: values.flow, job }
    },
    onSuccess: () => {
      toast.showSuccess('Execução enfileirada com sucesso.')
    },
    onError: (error) => toast.showError(error),
  })

  const flow = form.watch('flow')

  return (
    <div>
      <PageHeader
        title="Executar Agora"
        description="Disparo manual com retorno imediato de request_id/job_id e acompanhamento posterior."
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardTitle>Disparo manual</CardTitle>
          <CardDescription className="mb-4">
            Selecione o fluxo e os parâmetros da execução.
          </CardDescription>

          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          >
            <div>
              <Label htmlFor="run-flow">Fluxo</Label>
              <Select id="run-flow" {...form.register('flow')}>
                <option value="linkedin_post">linkedin_post</option>
                <option value="leetcode_commit">leetcode_commit</option>
              </Select>
            </div>

            {flow === 'linkedin_post' ? (
              <>
                <div>
                  <Label htmlFor="run-account">Conta LinkedIn</Label>
                  <Select
                    id="run-account"
                    value={String(form.watch('account_id') ?? '')}
                    onChange={(event) =>
                      form.setValue(
                        'account_id',
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                  >
                    <option value="">Selecione</option>
                    {(accountsQuery.data ?? []).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="run-topic">Topic</Label>
                  <Input
                    id="run-topic"
                    placeholder="AI Agents em produção"
                    {...form.register('topic')}
                  />
                </div>
                <div>
                  <Label htmlFor="run-paper-url">Paper URL</Label>
                  <Input
                    id="run-paper-url"
                    placeholder="https://arxiv.org/..."
                    {...form.register('paper_url')}
                  />
                </div>
                <div>
                  <Label htmlFor="run-paper-text">Paper Text (resumo opcional)</Label>
                  <Input id="run-paper-text" {...form.register('paper_text')} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="run-repo">Repositório GitHub</Label>
                  <Select
                    id="run-repo"
                    value={String(form.watch('repository_id') ?? '')}
                    onChange={(event) =>
                      form.setValue(
                        'repository_id',
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                  >
                    <option value="">Selecione</option>
                    {(repositoriesQuery.data ?? []).map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.repo_ssh_url}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="run-strategy">Selection strategy</Label>
                    <Select id="run-strategy" {...form.register('selection_strategy')}>
                      {selectionStrategies.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="run-policy">Difficulty policy</Label>
                    <Select id="run-policy" {...form.register('difficulty_policy')}>
                      {difficultyPolicies.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="run-slug">Problem slug (opcional)</Label>
                    <Input id="run-slug" placeholder="two-sum" {...form.register('problem_slug')} />
                  </div>
                  <div>
                    <Label htmlFor="run-attempts">Max attempts</Label>
                    <Input
                      id="run-attempts"
                      type="number"
                      min={1}
                      max={10}
                      {...form.register('max_attempts', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </>
            )}

            <Button className="w-full" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Disparando...' : 'Executar agora'}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Retorno imediato</CardTitle>
          <CardDescription className="mb-4">
            Após disparo, acompanhe via tela de execuções.
          </CardDescription>

          {!mutation.data ? (
            <p className="text-sm text-muted">Nenhuma execução disparada nesta sessão.</p>
          ) : (
            <div className="space-y-3 rounded-xl border border-border/70 bg-panel/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{mutation.data.flow}</p>
              <p className="font-mono text-xl text-slate-100">job_id #{mutation.data.job.id}</p>
              <StatusBadge status={mutation.data.job.status} />
              <div className="text-xs text-muted">
                <p>request_id/job_id retornado imediatamente.</p>
                <p>
                  Tentativas: {mutation.data.job.attempts}/{mutation.data.job.max_attempts}
                </p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to={`/execucoes?source=${mutation.data.flow}&id=${mutation.data.job.id}`}>
                  Acompanhar execução
                </Link>
              </Button>
            </div>
          )}

          {mutation.error ? (
            <div className="mt-3 rounded-xl border border-danger/60 bg-danger/10 p-3 text-sm text-danger">
              Erro explícito ao disparar execução. Revise payload e credenciais.
            </div>
          ) : null}

          <div className="mt-4 space-y-2 text-xs text-muted">
            <p>Tratamento assíncrono: disparo rápido + polling em Execuções.</p>
            <p>Falhas comuns: quota insuficiente, deduplicação, segredo inválido.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
