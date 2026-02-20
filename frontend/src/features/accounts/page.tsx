import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { GitHubAccount, GitHubRepository, LinkedinAccount } from '@/entities/types'
import { difficultyPolicies, selectionStrategies } from '@/shared/constants/options'
import { PageHeader } from '@/widgets/page-header'
import { api } from '@/shared/lib/api'
import { useApiToast } from '@/shared/hooks/use-api-toast'
import { Button } from '@/shared/ui/button'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { formatDateTime } from '@/shared/lib/utils'

const linkedinCreateSchema = z.object({
  name: z.string().min(2),
  token: z.string().min(10),
  urn: z.string().min(3),
  prompt_generation: z.string().optional(),
  prompt_translation: z.string().optional(),
  is_active: z.boolean(),
})

const linkedinUpdateSchema = z.object({
  token: z.string().optional(),
  urn: z.string().optional(),
  prompt_generation: z.string().optional(),
  prompt_translation: z.string().optional(),
  is_active: z.boolean(),
})

const githubCreateSchema = z.object({
  name: z.string().min(2),
  ssh_private_key: z.string().min(40),
  ssh_passphrase: z.string().optional(),
  is_active: z.boolean(),
})

const githubUpdateSchema = z.object({
  ssh_private_key: z.string().optional(),
  ssh_passphrase: z.string().optional(),
  is_active: z.boolean(),
})

const githubRepoCreateSchema = z.object({
  account_id: z.number().min(1),
  repo_ssh_url: z.string().min(10),
  default_branch: z.string().min(1),
  solutions_dir: z.string().min(1),
  commit_author_name: z.string().min(2),
  commit_author_email: z.string().email(),
  selection_strategy: z.string().min(1),
  difficulty_policy: z.string().min(1),
  is_active: z.boolean(),
})

const githubRepoUpdateSchema = z.object({
  default_branch: z.string().min(1),
  solutions_dir: z.string().min(1),
  commit_author_name: z.string().min(2),
  commit_author_email: z.string().email(),
  selection_strategy: z.string().min(1),
  difficulty_policy: z.string().min(1),
  is_active: z.boolean(),
})

export function AccountsPage() {
  return (
    <div>
      <PageHeader
        title="Contas"
        description="Gestão unificada de credenciais LinkedIn e GitHub usadas pelas automações."
      />

      <Tabs defaultValue="linkedin">
        <TabsList>
          <TabsTrigger value="linkedin">LinkedIn Accounts</TabsTrigger>
          <TabsTrigger value="github">GitHub Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="linkedin">
          <LinkedinAccountsTab />
        </TabsContent>

        <TabsContent value="github">
          <GithubAccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function LinkedinAccountsTab() {
  const toast = useApiToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<LinkedinAccount | null>(null)

  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })

  const createForm = useForm<z.infer<typeof linkedinCreateSchema>>({
    resolver: zodResolver(linkedinCreateSchema),
    defaultValues: {
      name: '',
      token: '',
      urn: '',
      prompt_generation: '',
      prompt_translation: '',
      is_active: true,
    },
  })

  const editForm = useForm<z.infer<typeof linkedinUpdateSchema>>({
    resolver: zodResolver(linkedinUpdateSchema),
    defaultValues: {
      token: '',
      urn: '',
      prompt_generation: '',
      prompt_translation: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (!editing) return
    editForm.reset({
      token: '',
      urn: editing.urn,
      prompt_generation: editing.prompt_generation ?? '',
      prompt_translation: editing.prompt_translation ?? '',
      is_active: editing.is_active,
    })
  }, [editForm, editing])

  const createMutation = useMutation({
    mutationFn: api.createLinkedinAccount,
    onSuccess: () => {
      toast.showSuccess('Conta LinkedIn criada.')
      createForm.reset({
        name: '',
        token: '',
        urn: '',
        prompt_generation: '',
        prompt_translation: '',
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] })
    },
    onError: (error) => toast.showError(error),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: z.infer<typeof linkedinUpdateSchema> }) =>
      api.updateLinkedinAccount(id, payload),
    onSuccess: () => {
      toast.showSuccess('Conta LinkedIn atualizada.')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] })
    },
    onError: (error) => toast.showError(error),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteLinkedinAccount(id),
    onSuccess: () => {
      toast.showSuccess('Conta LinkedIn excluida.')
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['linkedin-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['linkedin-jobs'] })
    },
    onError: (error) => toast.showError(error),
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardTitle>LinkedIn Accounts</CardTitle>
        <CardDescription className="mb-4">
          Crie e gerencie contas usadas para publicação.
        </CardDescription>

        <div className="space-y-2">
          {(accountsQuery.data ?? []).map((account) => (
            <div key={account.id} className="rounded-xl border border-border/70 bg-panel/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{account.name}</p>
                  <p className="text-xs text-muted">URN: {account.urn}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={account.is_active}
                    onChange={(event) =>
                      updateMutation.mutate({
                        id: account.id,
                        payload: { is_active: event.currentTarget.checked },
                      })
                    }
                    label={account.is_active ? 'Ativa' : 'Inativa'}
                  />
                  <Button size="sm" variant="outline" onClick={() => setEditing(account)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm(`Excluir conta LinkedIn "${account.name}"?`)) return
                      deleteMutation.mutate(account.id)
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Atualizada em {formatDateTime(account.updated_at)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Nova conta LinkedIn</CardTitle>
        <CardDescription className="mb-4">Token e URN ficam protegidos no backend.</CardDescription>

        <form
          className="space-y-3"
          onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div>
            <Label htmlFor="li-name">Nome</Label>
            <Input id="li-name" {...createForm.register('name')} />
          </div>
          <div>
            <Label htmlFor="li-urn">URN</Label>
            <Input id="li-urn" {...createForm.register('urn')} />
          </div>
          <div>
            <Label htmlFor="li-token">Token</Label>
            <Textarea id="li-token" rows={4} {...createForm.register('token')} />
          </div>
          <div>
            <Label htmlFor="li-generation">Prompt geração (opcional)</Label>
            <Textarea id="li-generation" rows={2} {...createForm.register('prompt_generation')} />
          </div>
          <div>
            <Label htmlFor="li-translation">Prompt tradução (opcional)</Label>
            <Textarea id="li-translation" rows={2} {...createForm.register('prompt_translation')} />
          </div>
          <Switch
            checked={createForm.watch('is_active')}
            onChange={(event) => createForm.setValue('is_active', event.currentTarget.checked)}
            label="Conta ativa"
          />

          <Button className="w-full" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? 'Salvando...' : 'Criar conta'}
          </Button>
        </form>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar LinkedIn account</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-3"
            onSubmit={editForm.handleSubmit((values) => {
              if (!editing) return
              updateMutation.mutate({ id: editing.id, payload: values })
            })}
          >
            <div>
              <Label htmlFor="li-edit-urn">URN</Label>
              <Input id="li-edit-urn" {...editForm.register('urn')} />
            </div>
            <div>
              <Label htmlFor="li-edit-token">Novo token (opcional)</Label>
              <Textarea id="li-edit-token" rows={4} {...editForm.register('token')} />
            </div>
            <div>
              <Label htmlFor="li-edit-gen">Prompt geração</Label>
              <Textarea id="li-edit-gen" rows={2} {...editForm.register('prompt_generation')} />
            </div>
            <div>
              <Label htmlFor="li-edit-trans">Prompt tradução</Label>
              <Textarea id="li-edit-trans" rows={2} {...editForm.register('prompt_translation')} />
            </div>
            <Switch
              checked={editForm.watch('is_active')}
              onChange={(event) => editForm.setValue('is_active', event.currentTarget.checked)}
              label="Conta ativa"
            />
            <Button className="w-full" disabled={updateMutation.isPending} type="submit">
              {updateMutation.isPending ? 'Atualizando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function GithubAccountsTab() {
  const toast = useApiToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<GitHubAccount | null>(null)
  const [editingRepo, setEditingRepo] = useState<GitHubRepository | null>(null)

  const accountsQuery = useQuery({ queryKey: ['github-accounts'], queryFn: api.githubAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })

  const createForm = useForm<z.infer<typeof githubCreateSchema>>({
    resolver: zodResolver(githubCreateSchema),
    defaultValues: {
      name: '',
      ssh_private_key: '',
      ssh_passphrase: '',
      is_active: true,
    },
  })

  const editForm = useForm<z.infer<typeof githubUpdateSchema>>({
    resolver: zodResolver(githubUpdateSchema),
    defaultValues: {
      ssh_private_key: '',
      ssh_passphrase: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (!editing) return
    editForm.reset({
      ssh_private_key: '',
      ssh_passphrase: '',
      is_active: editing.is_active,
    })
  }, [editForm, editing])

  const repoCreateForm = useForm<z.infer<typeof githubRepoCreateSchema>>({
    resolver: zodResolver(githubRepoCreateSchema),
    defaultValues: {
      account_id: 0,
      repo_ssh_url: '',
      default_branch: 'main',
      solutions_dir: 'problems',
      commit_author_name: '',
      commit_author_email: '',
      selection_strategy: 'random',
      difficulty_policy: 'free_any',
      is_active: true,
    },
  })

  const repoEditForm = useForm<z.infer<typeof githubRepoUpdateSchema>>({
    resolver: zodResolver(githubRepoUpdateSchema),
    defaultValues: {
      default_branch: 'main',
      solutions_dir: 'problems',
      commit_author_name: '',
      commit_author_email: '',
      selection_strategy: 'random',
      difficulty_policy: 'free_any',
      is_active: true,
    },
  })

  useEffect(() => {
    if (!editingRepo) return
    repoEditForm.reset({
      default_branch: editingRepo.default_branch,
      solutions_dir: editingRepo.solutions_dir,
      commit_author_name: editingRepo.commit_author_name,
      commit_author_email: editingRepo.commit_author_email,
      selection_strategy: editingRepo.selection_strategy,
      difficulty_policy: editingRepo.difficulty_policy,
      is_active: editingRepo.is_active,
    })
  }, [editingRepo, repoEditForm])

  const createMutation = useMutation({
    mutationFn: api.createGithubAccount,
    onSuccess: () => {
      toast.showSuccess('Conta GitHub criada.')
      createForm.reset({ name: '', ssh_private_key: '', ssh_passphrase: '', is_active: true })
      queryClient.invalidateQueries({ queryKey: ['github-accounts'] })
    },
    onError: (error) => toast.showError(error),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: z.infer<typeof githubUpdateSchema> }) =>
      api.updateGithubAccount(id, payload),
    onSuccess: () => {
      toast.showSuccess('Conta GitHub atualizada.')
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ['github-accounts'] })
    },
    onError: (error) => toast.showError(error),
  })

  const deleteAccountMutation = useMutation({
    mutationFn: (id: number) => api.deleteGithubAccount(id),
    onSuccess: () => {
      toast.showSuccess('Conta GitHub excluida.')
      queryClient.invalidateQueries({ queryKey: ['github-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-completed'] })
    },
    onError: (error) => toast.showError(error),
  })

  const createRepoMutation = useMutation({
    mutationFn: api.createGithubRepository,
    onSuccess: () => {
      toast.showSuccess('Repositório GitHub criado.')
      repoCreateForm.reset({
        account_id: 0,
        repo_ssh_url: '',
        default_branch: 'main',
        solutions_dir: 'problems',
        commit_author_name: '',
        commit_author_email: '',
        selection_strategy: 'random',
        difficulty_policy: 'free_any',
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
    },
    onError: (error) => toast.showError(error),
  })

  const updateRepoMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: z.infer<typeof githubRepoUpdateSchema>
    }) => api.updateGithubRepository(id, payload),
    onSuccess: () => {
      toast.showSuccess('Repositório GitHub atualizado.')
      setEditingRepo(null)
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
    },
    onError: (error) => toast.showError(error),
  })

  const deleteRepoMutation = useMutation({
    mutationFn: (id: number) => api.deleteGithubRepository(id),
    onSuccess: () => {
      toast.showSuccess('Repositorio GitHub excluido.')
      queryClient.invalidateQueries({ queryKey: ['github-repositories'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['leetcode-completed'] })
    },
    onError: (error) => toast.showError(error),
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardTitle>GitHub Accounts</CardTitle>
        <CardDescription className="mb-4">A chave SSH não é retornada pela API.</CardDescription>

        <div className="space-y-2">
          {(accountsQuery.data ?? []).map((account) => (
            <div key={account.id} className="rounded-xl border border-border/70 bg-panel/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{account.name}</p>
                  <p className="text-xs text-muted">
                    SSH carregada: {account.has_ssh_key ? 'sim' : 'não'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={account.is_active}
                    onChange={(event) =>
                      updateMutation.mutate({
                        id: account.id,
                        payload: { is_active: event.currentTarget.checked },
                      })
                    }
                    label={account.is_active ? 'Ativa' : 'Inativa'}
                  />
                  <Button size="sm" variant="outline" onClick={() => setEditing(account)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm(`Excluir conta GitHub "${account.name}"?`)) return
                      deleteAccountMutation.mutate(account.id)
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                Atualizada em {formatDateTime(account.updated_at)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Nova conta GitHub</CardTitle>
        <CardDescription className="mb-4">
          Use a chave privada SSH da conta que fará os commits.
        </CardDescription>

        <form
          className="space-y-3"
          onSubmit={createForm.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div>
            <Label htmlFor="gh-name">Nome</Label>
            <Input id="gh-name" {...createForm.register('name')} />
          </div>
          <div>
            <Label htmlFor="gh-key">SSH Private Key</Label>
            <Textarea id="gh-key" rows={6} {...createForm.register('ssh_private_key')} />
          </div>
          <div>
            <Label htmlFor="gh-pass">Passphrase (opcional)</Label>
            <Input id="gh-pass" type="password" {...createForm.register('ssh_passphrase')} />
          </div>
          <Switch
            checked={createForm.watch('is_active')}
            onChange={(event) => createForm.setValue('is_active', event.currentTarget.checked)}
            label="Conta ativa"
          />
          <Button className="w-full" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? 'Salvando...' : 'Criar conta'}
          </Button>
        </form>
      </Card>

      <Card className="xl:col-span-2">
        <CardTitle>Repositórios GitHub</CardTitle>
        <CardDescription className="mb-4">
          Configure o destino dos commits de automação LeetCode.
        </CardDescription>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-2">
            {(repositoriesQuery.data ?? []).map((repository) => (
              <div
                key={repository.id}
                className="rounded-xl border border-border/70 bg-panel/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-100">{repository.repo_ssh_url}</p>
                    <p className="text-xs text-muted">
                      Branch {repository.default_branch} • Dir {repository.solutions_dir}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={repository.is_active}
                      onChange={(event) =>
                        updateRepoMutation.mutate({
                          id: repository.id,
                          payload: {
                            default_branch: repository.default_branch,
                            solutions_dir: repository.solutions_dir,
                            commit_author_name: repository.commit_author_name,
                            commit_author_email: repository.commit_author_email,
                            selection_strategy: repository.selection_strategy,
                            difficulty_policy: repository.difficulty_policy,
                            is_active: event.currentTarget.checked,
                          },
                        })
                      }
                      label={repository.is_active ? 'Ativo' : 'Inativo'}
                    />
                    <Button size="sm" variant="outline" onClick={() => setEditingRepo(repository)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm(`Excluir repositorio "${repository.repo_ssh_url}"?`)) return
                        deleteRepoMutation.mutate(repository.id)
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Autor: {repository.commit_author_name} ({repository.commit_author_email})
                </p>
              </div>
            ))}
          </div>

          <form
            className="space-y-3"
            onSubmit={repoCreateForm.handleSubmit((values) => createRepoMutation.mutate(values))}
          >
            <div>
              <Label htmlFor="repo-account-id">Conta GitHub</Label>
              <Select
                id="repo-account-id"
                value={String(repoCreateForm.watch('account_id') ?? 0)}
                onChange={(event) =>
                  repoCreateForm.setValue('account_id', Number(event.target.value))
                }
              >
                <option value={0}>Selecione</option>
                {(accountsQuery.data ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="repo-ssh">Repo SSH URL</Label>
              <Input
                id="repo-ssh"
                placeholder="git@github.com:owner/repo.git"
                {...repoCreateForm.register('repo_ssh_url')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="repo-branch">Default branch</Label>
                <Input id="repo-branch" {...repoCreateForm.register('default_branch')} />
              </div>
              <div>
                <Label htmlFor="repo-dir">Solutions dir</Label>
                <Input id="repo-dir" {...repoCreateForm.register('solutions_dir')} />
              </div>
            </div>
            <div>
              <Label htmlFor="repo-author-name">Commit author name</Label>
              <Input id="repo-author-name" {...repoCreateForm.register('commit_author_name')} />
            </div>
            <div>
              <Label htmlFor="repo-author-email">Commit author email</Label>
              <Input id="repo-author-email" {...repoCreateForm.register('commit_author_email')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="repo-selection">Selection strategy</Label>
                <Select id="repo-selection" {...repoCreateForm.register('selection_strategy')}>
                  {selectionStrategies.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="repo-difficulty">Difficulty policy</Label>
                <Select id="repo-difficulty" {...repoCreateForm.register('difficulty_policy')}>
                  {difficultyPolicies.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Switch
              checked={repoCreateForm.watch('is_active')}
              onChange={(event) =>
                repoCreateForm.setValue('is_active', event.currentTarget.checked)
              }
              label="Repositório ativo"
            />
            <Button className="w-full" disabled={createRepoMutation.isPending} type="submit">
              {createRepoMutation.isPending ? 'Salvando...' : 'Cadastrar repositório'}
            </Button>
          </form>
        </div>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar GitHub account</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={editForm.handleSubmit((values) => {
              if (!editing) return
              updateMutation.mutate({ id: editing.id, payload: values })
            })}
          >
            <div>
              <Label htmlFor="gh-edit-key">Nova chave SSH (opcional)</Label>
              <Textarea id="gh-edit-key" rows={6} {...editForm.register('ssh_private_key')} />
            </div>
            <div>
              <Label htmlFor="gh-edit-pass">Nova passphrase (opcional)</Label>
              <Input id="gh-edit-pass" type="password" {...editForm.register('ssh_passphrase')} />
            </div>
            <Switch
              checked={editForm.watch('is_active')}
              onChange={(event) => editForm.setValue('is_active', event.currentTarget.checked)}
              label="Conta ativa"
            />
            <Button className="w-full" disabled={updateMutation.isPending} type="submit">
              {updateMutation.isPending ? 'Atualizando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingRepo)} onOpenChange={(open) => !open && setEditingRepo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar repositório GitHub</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={repoEditForm.handleSubmit((values) => {
              if (!editingRepo) return
              updateRepoMutation.mutate({ id: editingRepo.id, payload: values })
            })}
          >
            <div className="rounded-xl border border-border/70 bg-panel/70 p-3 text-xs text-muted break-all">
              {editingRepo?.repo_ssh_url}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="repo-edit-branch">Default branch</Label>
                <Input id="repo-edit-branch" {...repoEditForm.register('default_branch')} />
              </div>
              <div>
                <Label htmlFor="repo-edit-dir">Solutions dir</Label>
                <Input id="repo-edit-dir" {...repoEditForm.register('solutions_dir')} />
              </div>
            </div>
            <div>
              <Label htmlFor="repo-edit-author-name">Commit author name</Label>
              <Input id="repo-edit-author-name" {...repoEditForm.register('commit_author_name')} />
            </div>
            <div>
              <Label htmlFor="repo-edit-author-email">Commit author email</Label>
              <Input
                id="repo-edit-author-email"
                {...repoEditForm.register('commit_author_email')}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="repo-edit-selection">Selection strategy</Label>
                <Select id="repo-edit-selection" {...repoEditForm.register('selection_strategy')}>
                  {selectionStrategies.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="repo-edit-difficulty">Difficulty policy</Label>
                <Select id="repo-edit-difficulty" {...repoEditForm.register('difficulty_policy')}>
                  {difficultyPolicies.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Switch
              checked={repoEditForm.watch('is_active')}
              onChange={(event) => repoEditForm.setValue('is_active', event.currentTarget.checked)}
              label="Repositório ativo"
            />
            <Button className="w-full" disabled={updateRepoMutation.isPending} type="submit">
              {updateRepoMutation.isPending ? 'Atualizando...' : 'Salvar alterações'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
