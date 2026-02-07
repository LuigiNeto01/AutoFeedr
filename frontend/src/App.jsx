import { useEffect, useState } from 'react'

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim()
  }

  const protocol = window.location.protocol
  const hostname = window.location.hostname
  return `${protocol}//${hostname}:8000`
}

const API_BASE = resolveApiBase()

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `HTTP ${response.status}`)
  }

  return response.json()
}

export default function App() {
  const [accounts, setAccounts] = useState([])
  const [schedules, setSchedules] = useState([])
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')

  const [accountForm, setAccountForm] = useState({ name: '', token: '', urn: '' })
  const [scheduleForm, setScheduleForm] = useState({ account_id: '', topic: '', cron_expr: '0 9 * * 1-5', timezone: 'America/Sao_Paulo' })
  const [jobForm, setJobForm] = useState({ account_id: '', topic: '', paper_url: '', paper_text: '' })

  async function loadAll() {
    try {
      setError('')
      const [acc, sch, jb] = await Promise.all([
        api('/accounts'),
        api('/schedules'),
        api('/jobs?limit=30'),
      ])
      setAccounts(acc)
      setSchedules(sch)
      setJobs(jb)
    } catch (e) {
      setError(`Falha ao carregar dados: ${e.message}`)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createAccount(e) {
    e.preventDefault()
    try {
      await api('/accounts', { method: 'POST', body: JSON.stringify(accountForm) })
      setAccountForm({ name: '', token: '', urn: '' })
      loadAll()
    } catch (e2) {
      setError(`Erro ao criar conta: ${e2.message}`)
    }
  }

  async function createSchedule(e) {
    e.preventDefault()
    try {
      await api('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          ...scheduleForm,
          account_id: Number(scheduleForm.account_id),
        }),
      })
      setScheduleForm({ account_id: '', topic: '', cron_expr: '0 9 * * 1-5', timezone: 'America/Sao_Paulo' })
      loadAll()
    } catch (e2) {
      setError(`Erro ao criar agenda: ${e2.message}`)
    }
  }

  async function publishNow(e) {
    e.preventDefault()
    try {
      await api('/jobs/publish-now', {
        method: 'POST',
        body: JSON.stringify({
          ...jobForm,
          account_id: Number(jobForm.account_id),
        }),
      })
      setJobForm({ account_id: '', topic: '', paper_url: '', paper_text: '' })
      loadAll()
    } catch (e2) {
      setError(`Erro ao criar job manual: ${e2.message}`)
    }
  }

  return (
    <div className="page">
      <header>
        <h1>AutoFeedr Admin</h1>
        <p>API: {API_BASE}</p>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="grid">
        <article className="card">
          <h2>Contas LinkedIn</h2>
          <form onSubmit={createAccount} className="form">
            <input placeholder="Nome interno" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
            <input placeholder="URN (ou sufixo)" value={accountForm.urn} onChange={(e) => setAccountForm({ ...accountForm, urn: e.target.value })} required />
            <textarea placeholder="Token" value={accountForm.token} onChange={(e) => setAccountForm({ ...accountForm, token: e.target.value })} required />
            <button type="submit">Salvar conta</button>
          </form>
          <ul>
            {accounts.map((a) => (
              <li key={a.id}>{a.id} - {a.name} - {a.urn}</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Agendas (cron)</h2>
          <form onSubmit={createSchedule} className="form">
            <input type="number" placeholder="account_id" value={scheduleForm.account_id} onChange={(e) => setScheduleForm({ ...scheduleForm, account_id: e.target.value })} required />
            <input placeholder="Tema" value={scheduleForm.topic} onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })} required />
            <input placeholder="Cron (ex: 0 9 * * 1-5)" value={scheduleForm.cron_expr} onChange={(e) => setScheduleForm({ ...scheduleForm, cron_expr: e.target.value })} required />
            <input placeholder="Timezone" value={scheduleForm.timezone} onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })} required />
            <button type="submit">Salvar agenda</button>
          </form>
          <ul>
            {schedules.map((s) => (
              <li key={s.id}>#{s.id} acc:{s.account_id} {s.topic} [{s.cron_expr}] ({s.timezone})</li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2>Publicar agora</h2>
          <form onSubmit={publishNow} className="form">
            <input type="number" placeholder="account_id" value={jobForm.account_id} onChange={(e) => setJobForm({ ...jobForm, account_id: e.target.value })} required />
            <input placeholder="Tema (opcional)" value={jobForm.topic} onChange={(e) => setJobForm({ ...jobForm, topic: e.target.value })} />
            <input placeholder="Paper URL (opcional)" value={jobForm.paper_url} onChange={(e) => setJobForm({ ...jobForm, paper_url: e.target.value })} />
            <textarea placeholder="Paper texto (opcional)" value={jobForm.paper_text} onChange={(e) => setJobForm({ ...jobForm, paper_text: e.target.value })} />
            <button type="submit">Criar job</button>
          </form>
        </article>
      </section>

      <section className="card">
        <h2>Jobs recentes</h2>
        <button onClick={loadAll}>Atualizar</button>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Conta</th><th>Status</th><th>Tema</th><th>Tentativas</th><th>Erro</th><th>Criado</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{j.id}</td>
                <td>{j.account_id}</td>
                <td>{j.status}</td>
                <td>{j.topic || '-'}</td>
                <td>{j.attempts}/{j.max_attempts}</td>
                <td>{j.error_message || '-'}</td>
                <td>{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
