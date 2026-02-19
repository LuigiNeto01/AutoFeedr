import { useEffect, useMemo, useState } from 'react'

const PAGES = ['overview', 'github-accounts', 'repositories', 'jobs', 'schedules', 'completed']
const STRATEGIES = ['random', 'easy_first', 'sequential']
const DIFFICULTIES = ['free_any', 'free_easy', 'free_easy_medium']

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE?.trim()
  const fallback = `${window.location.protocol}//${window.location.hostname}:8000`
  if (!fromEnv) return fallback

  try {
    const url = new URL(fromEnv)
    return `${url.protocol}//${url.host}`
  } catch (_error) {
    return fallback
  }
}

const API_BASE = resolveApiBase()

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

function dt(v) {
  if (!v) return '-'
  return new Date(v).toLocaleString('pt-BR')
}

function Badge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [health, setHealth] = useState(null)
  const [githubAccounts, setGithubAccounts] = useState([])
  const [repositories, setRepositories] = useState([])
  const [jobs, setJobs] = useState([])
  const [schedules, setSchedules] = useState([])
  const [completed, setCompleted] = useState([])

  const [jobLogs, setJobLogs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)

  const [accountForm, setAccountForm] = useState({
    name: '',
    ssh_private_key: '',
    ssh_passphrase: '',
    is_active: true,
  })

  const [repoForm, setRepoForm] = useState({
    account_id: '',
    repo_ssh_url: '',
    default_branch: 'main',
    solutions_dir: 'leetcode/python',
    commit_author_name: '',
    commit_author_email: '',
    selection_strategy: 'random',
    difficulty_policy: 'free_any',
    is_active: true,
  })

  const [runNowForm, setRunNowForm] = useState({
    repository_id: '',
    selection_strategy: '',
    difficulty_policy: '',
    problem_slug: '',
    max_attempts: 5,
  })

  const [scheduleForm, setScheduleForm] = useState({
    repository_id: '',
    day_of_week: 1,
    time_local: '09:00',
    timezone: 'America/Sao_Paulo',
    selection_strategy: 'random',
    difficulty_policy: 'free_any',
    max_attempts: 5,
    is_active: true,
  })

  const repositoryById = useMemo(
    () => Object.fromEntries(repositories.map((r) => [r.id, r])),
    [repositories]
  )

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [h, ga, gr, lj, ls, lc] = await Promise.all([
        api('/health'),
        api('/github/accounts'),
        api('/github/repositories'),
        api('/leetcode/jobs?limit=50'),
        api('/leetcode/schedules'),
        api('/leetcode/completed?limit=50'),
      ])
      setHealth(h)
      setGithubAccounts(ga)
      setRepositories(gr)
      setJobs(lj)
      setSchedules(ls)
      setCompleted(lc)
    } catch (e) {
      setError(`Falha ao carregar dados: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createGitHubAccount(event) {
    event.preventDefault()
    try {
      await api('/github/accounts', { method: 'POST', body: JSON.stringify(accountForm) })
      setAccountForm({ name: '', ssh_private_key: '', ssh_passphrase: '', is_active: true })
      await loadAll()
    } catch (e) {
      setError(`Falha ao criar conta GitHub: ${e.message}`)
    }
  }

  async function createRepository(event) {
    event.preventDefault()
    try {
      await api('/github/repositories', {
        method: 'POST',
        body: JSON.stringify({
          ...repoForm,
          account_id: Number(repoForm.account_id),
        }),
      })
      setRepoForm((prev) => ({ ...prev, repo_ssh_url: '', commit_author_name: '', commit_author_email: '' }))
      await loadAll()
    } catch (e) {
      setError(`Falha ao criar repositório: ${e.message}`)
    }
  }

  async function runNow(event) {
    event.preventDefault()
    try {
      const payload = {
        repository_id: Number(runNowForm.repository_id),
        max_attempts: Number(runNowForm.max_attempts),
      }
      if (runNowForm.selection_strategy) payload.selection_strategy = runNowForm.selection_strategy
      if (runNowForm.difficulty_policy) payload.difficulty_policy = runNowForm.difficulty_policy
      if (runNowForm.problem_slug.trim()) payload.problem_slug = runNowForm.problem_slug.trim()

      await api('/leetcode/jobs/run-now', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setRunNowForm((prev) => ({ ...prev, problem_slug: '' }))
      await loadAll()
    } catch (e) {
      setError(`Falha ao iniciar job: ${e.message}`)
    }
  }

  async function createSchedule(event) {
    event.preventDefault()
    try {
      await api('/leetcode/schedules', {
        method: 'POST',
        body: JSON.stringify({
          ...scheduleForm,
          repository_id: Number(scheduleForm.repository_id),
          day_of_week: Number(scheduleForm.day_of_week),
          max_attempts: Number(scheduleForm.max_attempts),
        }),
      })
      await loadAll()
    } catch (e) {
      setError(`Falha ao criar agendamento: ${e.message}`)
    }
  }

  async function loadJobLogs(jobId) {
    try {
      const logs = await api(`/leetcode/jobs/${jobId}/logs`)
      setSelectedJob(jobId)
      setJobLogs(logs)
    } catch (e) {
      setError(`Falha ao buscar logs do job ${jobId}: ${e.message}`)
    }
  }

  async function testConnection() {
    try {
      const result = await api('/health')
      setHealth(result)
      setError('')
    } catch (e) {
      setError(`Conexão API falhou (${API_BASE}): ${e.message}`)
    }
  }

  if (loading) {
    return <div className="loading">Carregando dados...</div>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>AutoFeedr</h1>
        <p>LeetCode -{'>'} GitHub</p>
        <p className="api-base">API: <code>{API_BASE}</code></p>
        <nav>
          {PAGES.map((entry) => (
            <button
              type="button"
              key={entry}
              className={`nav-btn ${page === entry ? 'active' : ''}`}
              onClick={() => setPage(entry)}
            >
              {entry}
            </button>
          ))}
        </nav>
        <button type="button" className="ghost" onClick={testConnection}>Testar conexão</button>
        <button type="button" onClick={loadAll}>Atualizar tudo</button>
      </aside>

      <main className="content">
        {error && <p className="error">{error}</p>}

        {page === 'overview' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Status API</h3>
              <p>{health?.status || 'desconhecido'}</p>
              <p>Serviço: {health?.service || '-'}</p>
            </article>
            <article className="panel">
              <h3>Resumo</h3>
              <ul className="simple-list">
                <li>Contas GitHub: <strong>{githubAccounts.length}</strong></li>
                <li>Repositórios: <strong>{repositories.length}</strong></li>
                <li>Jobs LeetCode: <strong>{jobs.length}</strong></li>
                <li>Agendamentos: <strong>{schedules.length}</strong></li>
                <li>Concluídos: <strong>{completed.length}</strong></li>
              </ul>
            </article>
            <article className="panel">
              <h3>Últimos jobs</h3>
              <ul className="simple-list">
                {jobs.slice(0, 8).map((job) => (
                  <li key={job.id}>
                    <span>#{job.id} {job.problem_slug || 'auto'}</span>
                    <Badge status={job.status} />
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {page === 'github-accounts' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Nova conta GitHub</h3>
              <form className="form" onSubmit={createGitHubAccount}>
                <input placeholder="Nome" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
                <textarea placeholder="SSH private key" value={accountForm.ssh_private_key} onChange={(e) => setAccountForm({ ...accountForm, ssh_private_key: e.target.value })} required />
                <input placeholder="Passphrase (opcional)" value={accountForm.ssh_passphrase} onChange={(e) => setAccountForm({ ...accountForm, ssh_passphrase: e.target.value })} />
                <label className="check"><input type="checkbox" checked={accountForm.is_active} onChange={(e) => setAccountForm({ ...accountForm, is_active: e.target.checked })} /> Ativa</label>
                <button type="submit">Salvar conta</button>
              </form>
            </article>
            <article className="panel">
              <h3>Contas cadastradas</h3>
              <ul className="simple-list">
                {githubAccounts.map((a) => (
                  <li key={a.id}>
                    <span>#{a.id} {a.name}</span>
                    <span>{a.has_ssh_key ? 'chave OK' : 'sem chave'} | {a.is_active ? 'ativa' : 'inativa'}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {page === 'repositories' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Novo repositório</h3>
              <form className="form" onSubmit={createRepository}>
                <select value={repoForm.account_id} onChange={(e) => setRepoForm({ ...repoForm, account_id: e.target.value })} required>
                  <option value="">Selecione a conta</option>
                  {githubAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input placeholder="git@github.com:owner/repo.git" value={repoForm.repo_ssh_url} onChange={(e) => setRepoForm({ ...repoForm, repo_ssh_url: e.target.value })} required />
                <input placeholder="Branch padrão" value={repoForm.default_branch} onChange={(e) => setRepoForm({ ...repoForm, default_branch: e.target.value })} required />
                <input placeholder="Diretório soluções" value={repoForm.solutions_dir} onChange={(e) => setRepoForm({ ...repoForm, solutions_dir: e.target.value })} required />
                <input placeholder="Autor commit" value={repoForm.commit_author_name} onChange={(e) => setRepoForm({ ...repoForm, commit_author_name: e.target.value })} required />
                <input placeholder="Email commit" value={repoForm.commit_author_email} onChange={(e) => setRepoForm({ ...repoForm, commit_author_email: e.target.value })} required />
                <select value={repoForm.selection_strategy} onChange={(e) => setRepoForm({ ...repoForm, selection_strategy: e.target.value })}>
                  {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={repoForm.difficulty_policy} onChange={(e) => setRepoForm({ ...repoForm, difficulty_policy: e.target.value })}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <label className="check"><input type="checkbox" checked={repoForm.is_active} onChange={(e) => setRepoForm({ ...repoForm, is_active: e.target.checked })} /> Ativo</label>
                <button type="submit">Salvar repositório</button>
              </form>
            </article>
            <article className="panel">
              <h3>Repositórios cadastrados</h3>
              <ul className="simple-list">
                {repositories.map((r) => (
                  <li key={r.id}>
                    <div>
                      <strong>#{r.id} {r.repo_ssh_url}</strong>
                      <p>{r.default_branch} | {r.solutions_dir}</p>
                    </div>
                    <span>{r.is_active ? 'ativo' : 'inativo'}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {page === 'jobs' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Disparar job imediato</h3>
              <form className="form" onSubmit={runNow}>
                <select value={runNowForm.repository_id} onChange={(e) => setRunNowForm({ ...runNowForm, repository_id: e.target.value })} required>
                  <option value="">Selecione o repositório</option>
                  {repositories.map((r) => <option key={r.id} value={r.id}>#{r.id} {r.repo_ssh_url}</option>)}
                </select>
                <select value={runNowForm.selection_strategy} onChange={(e) => setRunNowForm({ ...runNowForm, selection_strategy: e.target.value })}>
                  <option value="">Padrão do repositório</option>
                  {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={runNowForm.difficulty_policy} onChange={(e) => setRunNowForm({ ...runNowForm, difficulty_policy: e.target.value })}>
                  <option value="">Padrão do repositório</option>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input placeholder="Slug opcional (ex: two-sum)" value={runNowForm.problem_slug} onChange={(e) => setRunNowForm({ ...runNowForm, problem_slug: e.target.value })} />
                <input type="number" min="1" max="10" value={runNowForm.max_attempts} onChange={(e) => setRunNowForm({ ...runNowForm, max_attempts: e.target.value })} />
                <button type="submit">Executar</button>
              </form>
            </article>
            <article className="panel">
              <h3>Jobs</h3>
              <ul className="simple-list">
                {jobs.map((j) => (
                  <li key={j.id}>
                    <div>
                      <strong>#{j.id} {j.problem_slug || 'auto'}</strong>
                      <p>
                        Repo {repositoryById[j.repository_id]?.repo_ssh_url || `#${j.repository_id}`} | tentativa {j.attempts}/{j.max_attempts}
                      </p>
                      <p>{j.error_message || j.commit_sha || '-'}</p>
                    </div>
                    <div className="actions">
                      <Badge status={j.status} />
                      <button type="button" className="ghost" onClick={() => loadJobLogs(j.id)}>logs</button>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
            <article className="panel">
              <h3>Logs job {selectedJob ? `#${selectedJob}` : ''}</h3>
              <ul className="simple-list">
                {jobLogs.length === 0 && <li>Selecione um job para ver logs.</li>}
                {jobLogs.map((log) => (
                  <li key={log.id}>
                    <span>[{log.level}] {log.message}</span>
                    <span>{dt(log.created_at)}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {page === 'schedules' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Novo agendamento LeetCode</h3>
              <form className="form" onSubmit={createSchedule}>
                <select value={scheduleForm.repository_id} onChange={(e) => setScheduleForm({ ...scheduleForm, repository_id: e.target.value })} required>
                  <option value="">Selecione o repositório</option>
                  {repositories.map((r) => <option key={r.id} value={r.id}>#{r.id} {r.repo_ssh_url}</option>)}
                </select>
                <input type="number" min="0" max="6" value={scheduleForm.day_of_week} onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })} required />
                <input type="time" value={scheduleForm.time_local} onChange={(e) => setScheduleForm({ ...scheduleForm, time_local: e.target.value })} required />
                <input value={scheduleForm.timezone} onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })} required />
                <select value={scheduleForm.selection_strategy} onChange={(e) => setScheduleForm({ ...scheduleForm, selection_strategy: e.target.value })}>
                  {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={scheduleForm.difficulty_policy} onChange={(e) => setScheduleForm({ ...scheduleForm, difficulty_policy: e.target.value })}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="number" min="1" max="10" value={scheduleForm.max_attempts} onChange={(e) => setScheduleForm({ ...scheduleForm, max_attempts: e.target.value })} required />
                <label className="check"><input type="checkbox" checked={scheduleForm.is_active} onChange={(e) => setScheduleForm({ ...scheduleForm, is_active: e.target.checked })} /> Ativo</label>
                <button type="submit">Salvar agendamento</button>
              </form>
            </article>
            <article className="panel">
              <h3>Agendamentos</h3>
              <ul className="simple-list">
                {schedules.map((s) => (
                  <li key={s.id}>
                    <div>
                      <strong>#{s.id} Repo #{s.repository_id}</strong>
                      <p>{s.day_of_week} @ {s.time_local} ({s.timezone})</p>
                      <p>{s.selection_strategy || 'repo default'} | {s.difficulty_policy || 'repo default'}</p>
                    </div>
                    <span>{s.is_active ? 'ativo' : 'inativo'}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        )}

        {page === 'completed' && (
          <section className="panel">
            <h3>Problemas concluídos</h3>
            <ul className="simple-list">
              {completed.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.problem_frontend_id} - {c.problem_title}</strong>
                    <p>{c.problem_slug} | {c.problem_difficulty}</p>
                    <p>Repo #{c.repository_id} | Job #{c.job_id}</p>
                  </div>
                  <span title={c.commit_sha}>{c.commit_sha?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
