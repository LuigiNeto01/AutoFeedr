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
  const [loading, setLoading] = useState(true)

  const [accountForm, setAccountForm] = useState({ name: '', token: '', urn: '' })
  const [scheduleForm, setScheduleForm] = useState({ account_id: '', topic: '', cron_expr: '0 9 * * 1-5', timezone: 'America/Sao_Paulo' })
  const [jobForm, setJobForm] = useState({ account_id: '', topic: '', paper_url: '', paper_text: '' })

  async function loadAll() {
    try {
      setError('')
      setLoading(true)
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
    } finally {
      setLoading(false)
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

  const accountNameById = Object.fromEntries(accounts.map((account) => [account.id, account.name]))
  const schedulesByAccount = accounts.map((account) => ({
    ...account,
    schedules: schedules.filter((schedule) => schedule.account_id === account.id),
  }))

  return (
    <div className="page">
      <header className="hero">
        <div>
          <h1>AutoFeedr Control Center</h1>
          <p className="subtitle">Gestao de contas, agendas e publicacao imediata</p>
          <p className="meta">API: {API_BASE}</p>
        </div>
        <button type="button" onClick={loadAll}>Atualizar dados</button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="grid forms-grid">
        <article className="card">
          <h2>Nova conta LinkedIn</h2>
          <form onSubmit={createAccount} className="form">
            <input placeholder="Nome interno" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
            <input placeholder="URN (ou sufixo)" value={accountForm.urn} onChange={(e) => setAccountForm({ ...accountForm, urn: e.target.value })} required />
            <textarea placeholder="Token" value={accountForm.token} onChange={(e) => setAccountForm({ ...accountForm, token: e.target.value })} required />
            <button type="submit">Salvar conta</button>
          </form>
        </article>

        <article className="card">
          <h2>Nova agenda (cron)</h2>
          <form onSubmit={createSchedule} className="form">
            <select value={scheduleForm.account_id} onChange={(e) => setScheduleForm({ ...scheduleForm, account_id: e.target.value })} required>
              <option value="">Selecione a conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.id} - {account.name}</option>
              ))}
            </select>
            <input placeholder="Tema" value={scheduleForm.topic} onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })} required />
            <input placeholder="Cron (ex: 0 9 * * 1-5)" value={scheduleForm.cron_expr} onChange={(e) => setScheduleForm({ ...scheduleForm, cron_expr: e.target.value })} required />
            <input placeholder="Timezone" value={scheduleForm.timezone} onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })} required />
            <button type="submit">Salvar agenda</button>
          </form>
          <p className="hint">Dica: para segunda a sexta as 09:00 use <code>0 9 * * 1-5</code>.</p>
        </article>

        <article className="card">
          <h2>Publicar agora</h2>
          <form onSubmit={publishNow} className="form">
            <select value={jobForm.account_id} onChange={(e) => setJobForm({ ...jobForm, account_id: e.target.value })} required>
              <option value="">Selecione a conta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.id} - {account.name}</option>
              ))}
            </select>
            <input placeholder="Tema (opcional)" value={jobForm.topic} onChange={(e) => setJobForm({ ...jobForm, topic: e.target.value })} />
            <input placeholder="Paper URL (opcional)" value={jobForm.paper_url} onChange={(e) => setJobForm({ ...jobForm, paper_url: e.target.value })} />
            <textarea placeholder="Paper texto (opcional)" value={jobForm.paper_text} onChange={(e) => setJobForm({ ...jobForm, paper_text: e.target.value })} />
            <button type="submit">Criar job</button>
          </form>
          <p className="hint">Se preencher mais de um campo (tema/url/texto), o worker prioriza texto, depois URL, depois tema.</p>
        </article>
      </section>

      <section className="accounts">
        <div className="section-head">
          <h2>Contas e agendas</h2>
          <span>{accounts.length} conta(s)</span>
        </div>
        {loading && <p className="hint">Carregando dados...</p>}
        {!loading && schedulesByAccount.length === 0 && <p className="hint">Nenhuma conta cadastrada.</p>}
        <div className="accounts-grid">
          {schedulesByAccount.map((account) => (
            <article key={account.id} className="card account-card">
              <div className="account-title">
                <h3>{account.name}</h3>
                <span className={account.is_active ? 'badge ok' : 'badge off'}>
                  {account.is_active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <p className="muted">ID: {account.id}</p>
              <p className="muted">URN: {account.urn}</p>
              <h4>Agendas</h4>
              {account.schedules.length === 0 && <p className="hint">Sem agendas para esta conta.</p>}
              <ul className="agenda-list">
                {account.schedules.map((schedule) => (
                  <li key={schedule.id}>
                    <p><strong>{schedule.topic}</strong></p>
                    <p>Cron: <code>{schedule.cron_expr}</code></p>
                    <p>Timezone: {schedule.timezone}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card jobs-card">
        <div className="section-head">
          <h2>Jobs recentes</h2>
          <span>{jobs.length} job(s)</span>
        </div>
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
                <td>{accountNameById[j.account_id] || `Conta #${j.account_id}`}</td>
                <td><span className={`badge ${j.status === 'success' ? 'ok' : j.status === 'failed' ? 'off' : 'wait'}`}>{j.status}</span></td>
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
