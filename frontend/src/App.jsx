import { useEffect, useMemo, useState } from 'react'

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

const API_BASE = resolveApiBase()
const PAGES = ['home', 'accounts', 'agenda', 'publish']
const WEEK_DAYS = [
  { key: 1, label: 'Segunda' },
  { key: 2, label: 'Terça' },
  { key: 3, label: 'Quarta' },
  { key: 4, label: 'Quinta' },
  { key: 5, label: 'Sexta' },
  { key: 6, label: 'Sábado' },
  { key: 0, label: 'Domingo' },
]

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

function toDateLabel(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR')
}

function parseDayPart(part) {
  if (part === '*') return [0, 1, 2, 3, 4, 5, 6]
  const values = new Set()
  const chunks = part.split(',')
  for (const chunk of chunks) {
    if (chunk.includes('-')) {
      const [startRaw, endRaw] = chunk.split('-')
      let start = Number(startRaw)
      let end = Number(endRaw)
      if (Number.isNaN(start) || Number.isNaN(end)) continue
      if (start === 7) start = 0
      if (end === 7) end = 0
      if (start <= end) {
        for (let value = start; value <= end; value += 1) values.add(value)
      } else {
        for (let value = start; value <= 6; value += 1) values.add(value)
        for (let value = 0; value <= end; value += 1) values.add(value)
      }
    } else {
      let value = Number(chunk)
      if (Number.isNaN(value)) continue
      if (value === 7) value = 0
      values.add(value)
    }
  }
  return [...values]
}

function scheduleToCalendarEvents(schedule, accountNameById) {
  const parts = schedule.cron_expr.split(/\s+/)
  if (parts.length < 5) {
    return [{ complex: true, label: schedule.cron_expr, schedule }]
  }
  const [minutePart, hourPart, , , dayPart] = parts
  const hour = Number(hourPart)
  const minute = Number(minutePart)
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return [{ complex: true, label: schedule.cron_expr, schedule }]
  }

  const days = parseDayPart(dayPart)
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  return days.map((day) => ({
    complex: false,
    day,
    time,
    label: `${schedule.topic} • ${accountNameById[schedule.account_id] || `Conta #${schedule.account_id}`}`,
    schedule,
  }))
}

function StatCard({ title, value, subtitle }) {
  return (
    <article className="stat-card">
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-subtitle">{subtitle}</p>
    </article>
  )
}

export default function App() {
  const [page, setPage] = useState(PAGES[0])
  const [accounts, setAccounts] = useState([])
  const [schedules, setSchedules] = useState([])
  const [jobs, setJobs] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [accountForm, setAccountForm] = useState({ name: '', token: '', urn: '' })
  const [editingAccount, setEditingAccount] = useState(null)
  const [editAccountForm, setEditAccountForm] = useState({ urn: '', token: '', is_active: true })

  const [scheduleForm, setScheduleForm] = useState({
    account_id: '',
    topic: '',
    cron_expr: '0 9 * * 1-5',
    timezone: 'America/Sao_Paulo',
  })
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [editScheduleForm, setEditScheduleForm] = useState({ topic: '', cron_expr: '', timezone: '', is_active: true })

  const [publishMode, setPublishMode] = useState('topic')
  const [jobForm, setJobForm] = useState({ account_id: '', topic: '', paper_url: '', paper_text: '' })

  async function loadAll() {
    try {
      setError('')
      setLoading(true)
      const [acc, sch, jb] = await Promise.all([
        api('/accounts'),
        api('/schedules'),
        api('/jobs?limit=50'),
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

  const accountNameById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account.name])),
    [accounts]
  )

  const calendarData = useMemo(() => {
    const byDay = Object.fromEntries(WEEK_DAYS.map((d) => [d.key, []]))
    const complex = []
    for (const schedule of schedules) {
      const events = scheduleToCalendarEvents(schedule, accountNameById)
      for (const event of events) {
        if (event.complex) complex.push(event)
        else byDay[event.day].push(event)
      }
    }
    for (const day of WEEK_DAYS) {
      byDay[day.key].sort((a, b) => a.time.localeCompare(b.time))
    }
    return { byDay, complex }
  }, [schedules, accountNameById])

  const stats = useMemo(() => {
    const success = jobs.filter((job) => job.status === 'success').length
    const failed = jobs.filter((job) => job.status === 'failed').length
    const waiting = jobs.filter((job) => ['pending', 'retry', 'running'].includes(job.status)).length
    return { success, failed, waiting }
  }, [jobs])

  async function createAccount(event) {
    event.preventDefault()
    try {
      await api('/accounts', { method: 'POST', body: JSON.stringify(accountForm) })
      setAccountForm({ name: '', token: '', urn: '' })
      await loadAll()
    } catch (e) {
      setError(`Erro ao criar conta: ${e.message}`)
    }
  }

  function openEditAccount(account) {
    setEditingAccount(account)
    setEditAccountForm({ urn: account.urn, token: '', is_active: account.is_active })
  }

  async function updateAccount(event) {
    event.preventDefault()
    if (!editingAccount) return
    try {
      const payload = {
        urn: editAccountForm.urn,
        is_active: editAccountForm.is_active,
      }
      if (editAccountForm.token.trim()) payload.token = editAccountForm.token.trim()
      await api(`/accounts/${editingAccount.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      setEditingAccount(null)
      await loadAll()
    } catch (e) {
      setError(`Erro ao atualizar conta: ${e.message}`)
    }
  }

  async function createSchedule(event) {
    event.preventDefault()
    try {
      await api('/schedules', {
        method: 'POST',
        body: JSON.stringify({ ...scheduleForm, account_id: Number(scheduleForm.account_id) }),
      })
      setScheduleForm({ account_id: '', topic: '', cron_expr: '0 9 * * 1-5', timezone: 'America/Sao_Paulo' })
      await loadAll()
    } catch (e) {
      setError(`Erro ao criar agenda: ${e.message}`)
    }
  }

  function openEditSchedule(schedule) {
    setEditingSchedule(schedule)
    setEditScheduleForm({
      topic: schedule.topic,
      cron_expr: schedule.cron_expr,
      timezone: schedule.timezone,
      is_active: schedule.is_active,
    })
  }

  async function updateSchedule(event) {
    event.preventDefault()
    if (!editingSchedule) return
    try {
      await api(`/schedules/${editingSchedule.id}`, { method: 'PUT', body: JSON.stringify(editScheduleForm) })
      setEditingSchedule(null)
      await loadAll()
    } catch (e) {
      setError(`Erro ao atualizar agenda: ${e.message}`)
    }
  }

  async function publishNow(event) {
    event.preventDefault()
    try {
      const payload = { account_id: Number(jobForm.account_id) }
      if (publishMode === 'topic') payload.topic = jobForm.topic
      if (publishMode === 'url') payload.paper_url = jobForm.paper_url
      if (publishMode === 'text') payload.paper_text = jobForm.paper_text
      await api('/jobs/publish-now', { method: 'POST', body: JSON.stringify(payload) })
      setJobForm({ account_id: '', topic: '', paper_url: '', paper_text: '' })
      await loadAll()
    } catch (e) {
      setError(`Erro ao criar job manual: ${e.message}`)
    }
  }

  const recentJobs = jobs.slice(0, 8)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>AutoFeedr</h1>
        <p>Painel de operação</p>
        <nav>
          <button className={page === 'home' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('home')}>Home</button>
          <button className={page === 'accounts' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('accounts')}>Contas</button>
          <button className={page === 'agenda' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('agenda')}>Agenda</button>
          <button className={page === 'publish' ? 'nav-btn active' : 'nav-btn'} onClick={() => setPage('publish')}>Publicar</button>
        </nav>
      </aside>

      <main className="content">
        <header className="page-head">
          <div>
            <h2>{page === 'home' ? 'Home' : page === 'accounts' ? 'Contas' : page === 'agenda' ? 'Agenda' : 'Publicar'}</h2>
            <p>{loading ? 'Carregando dados...' : `API conectada: ${API_BASE}`}</p>
          </div>
          <button onClick={loadAll}>Atualizar</button>
        </header>

        {error && <div className="error">{error}</div>}

        {page === 'home' && (
          <>
            <section className="stats-grid">
              <StatCard title="Contas ativas" value={accounts.filter((a) => a.is_active).length} subtitle={`${accounts.length} conta(s) total`} />
              <StatCard title="Agendas ativas" value={schedules.filter((s) => s.is_active).length} subtitle={`${schedules.length} agenda(s) cadastrada(s)`} />
              <StatCard title="Posts com sucesso" value={stats.success} subtitle={`${stats.failed} falhas | ${stats.waiting} em fila`} />
            </section>

            <section className="panel-grid">
              <article className="panel">
                <h3>Contas</h3>
                <ul className="simple-list">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <span>{account.name}</span>
                      <span className={account.is_active ? 'badge ok' : 'badge off'}>
                        {account.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="panel">
                <h3>Últimos jobs</h3>
                <ul className="simple-list">
                  {recentJobs.map((job) => (
                    <li key={job.id}>
                      <span>{accountNameById[job.account_id] || `Conta #${job.account_id}`}</span>
                      <span className={`badge ${job.status === 'success' ? 'ok' : job.status === 'failed' ? 'off' : 'wait'}`}>
                        {job.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          </>
        )}

        {page === 'accounts' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Cadastrar conta</h3>
              <form onSubmit={createAccount} className="form">
                <input placeholder="Nome interno" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
                <input placeholder="URN (ou sufixo)" value={accountForm.urn} onChange={(e) => setAccountForm({ ...accountForm, urn: e.target.value })} required />
                <textarea placeholder="Token" value={accountForm.token} onChange={(e) => setAccountForm({ ...accountForm, token: e.target.value })} required />
                <button type="submit">Salvar conta</button>
              </form>
            </article>

            <article className="panel">
              <h3>Contas cadastradas</h3>
              <ul className="account-list">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <div>
                      <strong>{account.name}</strong>
                      <p>ID: {account.id} • URN: {account.urn}</p>
                    </div>
                    <button onClick={() => openEditAccount(account)}>Editar</button>
                  </li>
                ))}
              </ul>
            </article>

            {editingAccount && (
              <article className="panel">
                <h3>Editar conta: {editingAccount.name}</h3>
                <form onSubmit={updateAccount} className="form">
                  <input placeholder="URN" value={editAccountForm.urn} onChange={(e) => setEditAccountForm({ ...editAccountForm, urn: e.target.value })} required />
                  <textarea placeholder="Novo token (opcional)" value={editAccountForm.token} onChange={(e) => setEditAccountForm({ ...editAccountForm, token: e.target.value })} />
                  <label className="check">
                    <input type="checkbox" checked={editAccountForm.is_active} onChange={(e) => setEditAccountForm({ ...editAccountForm, is_active: e.target.checked })} />
                    Conta ativa
                  </label>
                  <div className="actions">
                    <button type="submit">Salvar alterações</button>
                    <button type="button" className="ghost" onClick={() => setEditingAccount(null)}>Cancelar</button>
                  </div>
                </form>
              </article>
            )}
          </section>
        )}

        {page === 'agenda' && (
          <>
            <section className="panel-grid">
              <article className="panel">
                <h3>Cadastrar agenda</h3>
                <form onSubmit={createSchedule} className="form">
                  <select value={scheduleForm.account_id} onChange={(e) => setScheduleForm({ ...scheduleForm, account_id: e.target.value })} required>
                    <option value="">Selecione a conta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                  <input placeholder="Tema" value={scheduleForm.topic} onChange={(e) => setScheduleForm({ ...scheduleForm, topic: e.target.value })} required />
                  <input placeholder="Cron (ex: 0 9 * * 1-5)" value={scheduleForm.cron_expr} onChange={(e) => setScheduleForm({ ...scheduleForm, cron_expr: e.target.value })} required />
                  <input placeholder="Timezone" value={scheduleForm.timezone} onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })} required />
                  <button type="submit">Salvar agenda</button>
                </form>
              </article>

              <article className="panel">
                <h3>Agendas cadastradas</h3>
                <ul className="agenda-list">
                  {schedules.map((schedule) => (
                    <li key={schedule.id}>
                      <div>
                        <strong>{schedule.topic}</strong>
                        <p>{accountNameById[schedule.account_id] || `Conta #${schedule.account_id}`}</p>
                        <p><code>{schedule.cron_expr}</code> • {schedule.timezone}</p>
                      </div>
                      <button onClick={() => openEditSchedule(schedule)}>Editar</button>
                    </li>
                  ))}
                </ul>
              </article>

              {editingSchedule && (
                <article className="panel">
                  <h3>Editar agenda</h3>
                  <form onSubmit={updateSchedule} className="form">
                    <input placeholder="Tema" value={editScheduleForm.topic} onChange={(e) => setEditScheduleForm({ ...editScheduleForm, topic: e.target.value })} required />
                    <input placeholder="Cron" value={editScheduleForm.cron_expr} onChange={(e) => setEditScheduleForm({ ...editScheduleForm, cron_expr: e.target.value })} required />
                    <input placeholder="Timezone" value={editScheduleForm.timezone} onChange={(e) => setEditScheduleForm({ ...editScheduleForm, timezone: e.target.value })} required />
                    <label className="check">
                      <input type="checkbox" checked={editScheduleForm.is_active} onChange={(e) => setEditScheduleForm({ ...editScheduleForm, is_active: e.target.checked })} />
                      Agenda ativa
                    </label>
                    <div className="actions">
                      <button type="submit">Salvar alterações</button>
                      <button type="button" className="ghost" onClick={() => setEditingSchedule(null)}>Cancelar</button>
                    </div>
                  </form>
                </article>
              )}
            </section>

            <section className="calendar-wrap">
              <h3>Calendário semanal de postagens</h3>
              <div className="calendar-grid">
                {WEEK_DAYS.map((day) => (
                  <article key={day.key} className="calendar-day">
                    <header>{day.label}</header>
                    <div className="calendar-items">
                      {calendarData.byDay[day.key]?.length ? calendarData.byDay[day.key].map((event, index) => (
                        <div key={`${event.schedule.id}-${index}`} className="calendar-item">
                          <p className="time">{event.time}</p>
                          <p>{event.label}</p>
                        </div>
                      )) : <p className="empty">Sem postagens</p>}
                    </div>
                  </article>
                ))}
              </div>

              {calendarData.complex.length > 0 && (
                <article className="panel complex-panel">
                  <h4>Regras avançadas (fora da visualização semanal)</h4>
                  <ul>
                    {calendarData.complex.map((item, idx) => (
                      <li key={`${item.schedule.id}-${idx}`}>
                        {item.schedule.topic} • <code>{item.label}</code> • {accountNameById[item.schedule.account_id] || `Conta #${item.schedule.account_id}`}
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          </>
        )}

        {page === 'publish' && (
          <section className="panel-grid">
            <article className="panel">
              <h3>Publicação imediata</h3>
              <div className="mode-switch">
                <button className={publishMode === 'topic' ? 'active' : ''} onClick={() => setPublishMode('topic')}>Por tema</button>
                <button className={publishMode === 'url' ? 'active' : ''} onClick={() => setPublishMode('url')}>Por link do paper</button>
                <button className={publishMode === 'text' ? 'active' : ''} onClick={() => setPublishMode('text')}>Por texto do paper</button>
              </div>
              <form onSubmit={publishNow} className="form">
                <select value={jobForm.account_id} onChange={(e) => setJobForm({ ...jobForm, account_id: e.target.value })} required>
                  <option value="">Selecione a conta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>

                {publishMode === 'topic' && (
                  <input placeholder="Tema (ex: machine learning)" value={jobForm.topic} onChange={(e) => setJobForm({ ...jobForm, topic: e.target.value })} required />
                )}
                {publishMode === 'url' && (
                  <input placeholder="URL do paper (arXiv ou similar)" value={jobForm.paper_url} onChange={(e) => setJobForm({ ...jobForm, paper_url: e.target.value })} required />
                )}
                {publishMode === 'text' && (
                  <textarea placeholder="Cole o texto/resumo do paper aqui" value={jobForm.paper_text} onChange={(e) => setJobForm({ ...jobForm, paper_text: e.target.value })} required />
                )}

                <button type="submit">Criar job de publicação</button>
              </form>
            </article>

            <article className="panel">
              <h3>Últimos jobs</h3>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Conta</th>
                    <th>Status</th>
                    <th>Tema</th>
                    <th>Tent.</th>
                    <th>Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 15).map((job) => (
                    <tr key={job.id}>
                      <td>{job.id}</td>
                      <td>{accountNameById[job.account_id] || job.account_id}</td>
                      <td><span className={`badge ${job.status === 'success' ? 'ok' : job.status === 'failed' ? 'off' : 'wait'}`}>{job.status}</span></td>
                      <td>{job.topic || '-'}</td>
                      <td>{job.attempts}/{job.max_attempts}</td>
                      <td>{toDateLabel(job.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </section>
        )}
      </main>
    </div>
  )
}
