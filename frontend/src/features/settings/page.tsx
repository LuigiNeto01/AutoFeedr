import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { API_BASE, api, setApiBase } from '@/shared/lib/api'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { PageHeader } from '@/widgets/page-header'

const settingsSchema = z.object({
  api_base: z.string().min(4),
})

export function SettingsPage() {
  const toast = useApiToast()
  const defaultsQuery = useQuery({ queryKey: ['prompts-defaults'], queryFn: api.prompts })
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
  })

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { api_base: API_BASE },
  })

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Base URL da API, conectividade, defaults operacionais e utilitários."
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardTitle>Conectividade da API</CardTitle>
          <CardDescription className="mb-4">Defina a URL base e atualize a sessão.</CardDescription>

          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => {
              setApiBase(values.api_base)
              toast.showSuccess('API base atualizada. Recarregando frontend...')
              window.setTimeout(() => window.location.reload(), 400)
            })}
          >
            <div>
              <Label htmlFor="cfg-api-base">API Base URL</Label>
              <Input id="cfg-api-base" {...form.register('api_base')} />
            </div>

            <div className="rounded-xl border border-border/70 bg-panel/70 p-3 text-sm">
              <p className="text-muted">Status atual:</p>
              <p className={healthQuery.data?.status === 'ok' ? 'text-success' : 'text-danger'}>
                {healthQuery.data?.status === 'ok' ? 'Online' : 'Offline'}
              </p>
              <p className="mt-1 text-xs text-muted">
                Serviço: {healthQuery.data?.service ?? 'autofeedr-api'}
              </p>
            </div>

            <Button className="w-full" type="submit">
              Salvar URL base
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Defaults operacionais</CardTitle>
          <CardDescription className="mb-4">Prompts padrão carregados do backend.</CardDescription>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cfg-prompt-gen">Prompt de geração</Label>
              <Textarea
                id="cfg-prompt-gen"
                rows={7}
                readOnly
                value={defaultsQuery.data?.prompt_generation ?? 'Carregando...'}
              />
            </div>
            <div>
              <Label htmlFor="cfg-prompt-trans">Prompt de tradução</Label>
              <Textarea
                id="cfg-prompt-trans"
                rows={7}
                readOnly
                value={defaultsQuery.data?.prompt_translation ?? 'Carregando...'}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Links utilitários</CardTitle>
        <CardDescription className="mb-3">Acesso rápido para operação e debugging.</CardDescription>
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <a
            className="rounded-xl border border-border/70 bg-panel/70 p-3 text-accent hover:underline"
            href={`${API_BASE}/docs`}
            rel="noreferrer"
            target="_blank"
          >
            Swagger UI
          </a>
          <a
            className="rounded-xl border border-border/70 bg-panel/70 p-3 text-accent hover:underline"
            href={`${window.location.protocol}//${window.location.hostname}:8080`}
            rel="noreferrer"
            target="_blank"
          >
            Adminer
          </a>
          <a
            className="rounded-xl border border-border/70 bg-panel/70 p-3 text-accent hover:underline"
            href={`${API_BASE}/health`}
            rel="noreferrer"
            target="_blank"
          >
            Health endpoint
          </a>
        </div>
      </Card>
    </div>
  )
}
