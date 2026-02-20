import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/lib/api'
import { formatDateTime, shortSha } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
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
import { KpiCard } from '@/widgets/kpi-card'
import { PageHeader } from '@/widgets/page-header'

export function ResultsPage() {
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'all' | 'linkedin' | 'leetcode'>('all')

  const accountsQuery = useQuery({ queryKey: ['linkedin-accounts'], queryFn: api.linkedinAccounts })
  const repositoriesQuery = useQuery({
    queryKey: ['github-repositories'],
    queryFn: api.githubRepositories,
  })
  const linkedinJobsQuery = useQuery({
    queryKey: ['linkedin-jobs', 200],
    queryFn: () => api.linkedinJobs(200),
  })
  const completedQuery = useQuery({
    queryKey: ['leetcode-completed', 200],
    queryFn: () => api.leetcodeCompleted({ limit: 200 }),
  })

  const publishedPosts = useMemo(
    () =>
      (linkedinJobsQuery.data ?? []).filter(
        (job) => job.status === 'success' && job.generated_post,
      ),
    [linkedinJobsQuery.data],
  )

  const completedProblems = useMemo(() => completedQuery.data ?? [], [completedQuery.data])

  const accountById = useMemo(
    () => new Map((accountsQuery.data ?? []).map((account) => [account.id, account.name])),
    [accountsQuery.data],
  )
  const repoById = useMemo(
    () =>
      new Map(
        (repositoriesQuery.data ?? []).map((repository) => [
          repository.id,
          repository.repo_ssh_url,
        ]),
      ),
    [repositoriesQuery.data],
  )

  const filteredPosts = useMemo(() => {
    return publishedPosts.filter((item) => {
      if (kind !== 'all' && kind !== 'linkedin') return false
      const combined = `${item.topic} ${item.generated_post}`.toLowerCase()
      return search ? combined.includes(search.toLowerCase()) : true
    })
  }, [kind, publishedPosts, search])

  const filteredProblems = useMemo(() => {
    return completedProblems.filter((item) => {
      if (kind !== 'all' && kind !== 'leetcode') return false
      const combined = `${item.problem_title} ${item.problem_slug} ${item.commit_sha}`.toLowerCase()
      return search ? combined.includes(search.toLowerCase()) : true
    })
  }, [completedProblems, kind, search])

  return (
    <div>
      <PageHeader
        title="Resultados"
        description="Auditoria de entregas: posts publicados e problemas concluídos com commit SHA."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Posts publicados" value={publishedPosts.length} />
        <KpiCard label="Problemas concluídos" value={completedProblems.length} />
        <KpiCard label="Contas LinkedIn" value={(accountsQuery.data ?? []).length} />
        <KpiCard label="Repos monitorados" value={(repositoriesQuery.data ?? []).length} />
      </section>

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="result-search">Busca</Label>
            <Input
              id="result-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Título, slug, conteúdo..."
            />
          </div>
          <div>
            <Label htmlFor="result-kind">Tipo</Label>
            <Select
              id="result-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as 'all' | 'linkedin' | 'leetcode')}
            >
              <option value="all">Tudo</option>
              <option value="linkedin">Somente LinkedIn</option>
              <option value="leetcode">Somente LeetCode</option>
            </Select>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Posts publicados</CardTitle>
          <CardDescription className="mb-4">
            Execuções de `linkedin_post` com status success.
          </CardDescription>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>ID</TableHeaderCell>
                  <TableHeaderCell>Conta</TableHeaderCell>
                  <TableHeaderCell>Topic</TableHeaderCell>
                  <TableHeaderCell>Publicado em</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>#{post.id}</TableCell>
                    <TableCell>
                      {accountById.get(post.account_id) ?? `Conta #${post.account_id}`}
                    </TableCell>
                    <TableCell>{post.topic ?? '-'}</TableCell>
                    <TableCell>{formatDateTime(post.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Card>
          <CardTitle>Problemas concluídos</CardTitle>
          <CardDescription className="mb-4">
            Resultados de `leetcode_commit` com commit associado.
          </CardDescription>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Question ID</TableHeaderCell>
                  <TableHeaderCell>Título</TableHeaderCell>
                  <TableHeaderCell>Dificuldade</TableHeaderCell>
                  <TableHeaderCell>Commit</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProblems.map((problem) => (
                  <TableRow key={problem.id}>
                    <TableCell>{problem.problem_frontend_id}</TableCell>
                    <TableCell>
                      <div>
                        <p>{problem.problem_title}</p>
                        <p className="text-xs text-muted">{problem.problem_slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{problem.problem_difficulty}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-mono text-xs">{shortSha(problem.commit_sha)}</p>
                        <p className="text-xs text-muted">
                          {repoById.get(problem.repository_id) ?? `Repo #${problem.repository_id}`}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </section>
    </div>
  )
}
