import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

export default function AdminUsersPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  async function loadUsers({ preserveSelection = true } = {}) {
    setLoadingUsers(true);
    try {
      const data = await api.adminUsers();
      setUsers(data ?? []);
      setError("");
      setSelectedUserId((prev) => {
        if (!data?.length) return null;
        if (preserveSelection && prev && data.some((u) => u.id === prev)) return prev;
        return data[0].id;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar usuarios admin."));
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadOverview(userId) {
    if (!userId) {
      setOverview(null);
      return;
    }
    setLoadingOverview(true);
    try {
      const data = await api.adminUserOverview(userId);
      setOverview(data);
      setError("");
    } catch (err) {
      setOverview(null);
      setError(getErrorMessage(err, "Falha ao carregar overview do usuario."));
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId != null) loadOverview(selectedUserId);
  }, [selectedUserId]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? overview?.user ?? null,
    [users, selectedUserId, overview],
  );

  const handleToggleActive = async (user) => {
    if (!user || saving) return;
    const nextActive = !user.is_active;
    const confirmMessage = nextActive
      ? `Reativar usuario ${user.email}?`
      : `Bloquear usuario ${user.email}? Isso tambem desativa agendamentos e revoga tokens ativos.`;
    if (!window.confirm(confirmMessage)) return;
    setSaving(true);
    try {
      await api.adminUpdateUser(user.id, { is_active: nextActive });
      await loadUsers();
      await loadOverview(user.id);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar status do usuario."));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user, role) => {
    if (!user || saving || !role || role === user.role) return;
    setSaving(true);
    try {
      await api.adminUpdateUser(user.id, { role });
      await loadUsers();
      await loadOverview(user.id);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar role do usuario."));
    } finally {
      setSaving(false);
    }
  };

  if (loadingUsers) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
          {error}
        </div>
      ) : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${sub}`}>Admin</p>
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Usuarios</h2>
            <p className={`mt-1 text-sm ${sub}`}>RBAC basico e visao consolidada por tenant.</p>
          </div>
          <button
            type="button"
            onClick={() => loadUsers({ preserveSelection: true })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-4 ${panel}`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${txt}`}>Lista de usuarios</h3>
            <span className={`text-xs ${sub}`}>{users.length} total</span>
          </div>
          {!users.length ? (
            <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nenhum usuario cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const active = selectedUserId === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? isDarkMode
                          ? "border-sky-500/60 bg-sky-500/10"
                          : "border-slate-900 bg-slate-100"
                        : card
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-semibold ${txt}`}>{user.email}</p>
                        <p className={`mt-1 text-xs ${sub}`}>ID #{user.id}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge tone={user.is_active ? "green" : "red"} text={user.is_active ? "Ativo" : "Bloqueado"} isDarkMode={isDarkMode} />
                        <Badge tone={user.role === "admin" ? "blue" : "gray"} text={user.role} isDarkMode={isDarkMode} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-8 ${panel}`}>
          {!selectedUser ? (
            <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Selecione um usuario para ver detalhes.</p>
          ) : loadingOverview ? (
            <div className={`h-72 animate-pulse rounded-xl ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} />
          ) : overview ? (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${card}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${sub}`}>Tenant</p>
                    <h3 className={`mt-1 text-lg font-semibold ${txt}`}>{overview.user.email}</h3>
                    <p className={`mt-1 text-sm ${sub}`}>Criado em {formatDate(overview.user.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={overview.user.role}
                      disabled={saving}
                      onChange={(e) => handleRoleChange(overview.user, e.target.value)}
                      className={`rounded-lg border px-3 py-2 text-sm ${isDarkMode ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleToggleActive(overview.user)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                        overview.user.is_active
                          ? "bg-red-700 hover:bg-red-600"
                          : "bg-emerald-700 hover:bg-emerald-600"
                      }`}
                    >
                      {overview.user.is_active ? "Bloquear" : "Desbloquear"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="LinkedIn contas" value={overview.counts.linkedin_accounts} isDarkMode={isDarkMode} />
                <Stat label="GitHub contas" value={overview.counts.github_accounts} isDarkMode={isDarkMode} />
                <Stat label="Repositorios" value={overview.counts.github_repositories} isDarkMode={isDarkMode} />
                <Stat label="Schedules" value={overview.counts.linkedin_schedules + overview.counts.leetcode_schedules} isDarkMode={isDarkMode} />
                <Stat label="Jobs LinkedIn" value={overview.counts.linkedin_jobs} isDarkMode={isDarkMode} />
                <Stat label="Jobs LeetCode" value={overview.counts.leetcode_jobs} isDarkMode={isDarkMode} />
                <Stat label="Chave OpenAI" value={overview.user.has_openai_api_key ? "Sim" : "Nao"} isDarkMode={isDarkMode} />
                <Stat label="Status" value={overview.user.is_active ? "Ativo" : "Bloqueado"} isDarkMode={isDarkMode} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ListCard
                  title="Contas LinkedIn"
                  items={overview.linkedin_accounts.map((item) => ({
                    id: item.id,
                    title: item.name,
                    subtitle: item.urn,
                    active: item.is_active,
                  }))}
                  emptyText="Nenhuma conta LinkedIn."
                  isDarkMode={isDarkMode}
                />
                <ListCard
                  title="Contas GitHub"
                  items={overview.github_accounts.map((item) => ({
                    id: item.id,
                    title: item.name,
                    subtitle: item.has_ssh_key ? "SSH configurada" : "Sem SSH",
                    active: item.is_active,
                  }))}
                  emptyText="Nenhuma conta GitHub."
                  isDarkMode={isDarkMode}
                />
                <ListCard
                  title="Repositorios GitHub"
                  items={overview.github_repositories.map((item) => ({
                    id: item.id,
                    title: shortRepo(item.repo_ssh_url),
                    subtitle: item.repo_ssh_url,
                    active: item.is_active,
                  }))}
                  emptyText="Nenhum repositorio."
                  isDarkMode={isDarkMode}
                />
                <ListCard
                  title="Agendamentos"
                  items={[
                    ...overview.linkedin_schedules.slice(0, 5).map((item) => ({
                      id: `li-${item.id}`,
                      title: `LinkedIn • ${item.topic}`,
                      subtitle: item.time_local ? `${weekdayLabel(item.day_of_week)} ${item.time_local}` : item.cron_expr,
                      active: item.is_active,
                    })),
                    ...overview.leetcode_schedules.slice(0, 5).map((item) => ({
                      id: `lc-${item.id}`,
                      title: "LeetCode",
                      subtitle: item.time_local ? `${weekdayLabel(item.day_of_week)} ${item.time_local}` : item.cron_expr,
                      active: item.is_active,
                    })),
                  ]}
                  emptyText="Nenhum agendamento."
                  isDarkMode={isDarkMode}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <TableCard
                  title="Jobs LinkedIn recentes"
                  rows={overview.recent_linkedin_jobs.map((job) => ({
                    id: job.id,
                    c1: `#${job.id}`,
                    c2: job.status,
                    c3: job.topic || "-",
                  }))}
                  emptyText="Sem jobs LinkedIn."
                  isDarkMode={isDarkMode}
                />
                <TableCard
                  title="Jobs LeetCode recentes"
                  rows={overview.recent_leetcode_jobs.map((job) => ({
                    id: job.id,
                    c1: `#${job.id}`,
                    c2: job.status,
                    c3: job.problem_slug || "-",
                  }))}
                  emptyText="Sem jobs LeetCode."
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
          ) : (
            <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nao foi possivel carregar o overview.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, isDarkMode }) {
  return (
    <div className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{String(value)}</p>
    </div>
  );
}

function Badge({ tone = "gray", text, isDarkMode }) {
  const map = {
    green: isDarkMode ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700",
    red: isDarkMode ? "bg-red-500/15 text-red-300" : "bg-red-100 text-red-700",
    blue: isDarkMode ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700",
    gray: isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700",
  };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${map[tone] || map.gray}`}>{text}</span>;
}

function ListCard({ title, items, emptyText, isDarkMode }) {
  return (
    <section className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50/80"}`}>
      <h4 className={`mb-3 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h4>
      {items.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={`rounded-lg border p-2 ${isDarkMode ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{item.title}</p>
                  <p className={`truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{item.subtitle}</p>
                </div>
                {typeof item.active === "boolean" ? (
                  <Badge tone={item.active ? "green" : "red"} text={item.active ? "Ativo" : "Off"} isDarkMode={isDarkMode} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TableCard({ title, rows, emptyText, isDarkMode }) {
  return (
    <section className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50/80"}`}>
      <h4 className={`mb-3 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h4>
      {rows.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className={`grid grid-cols-[56px_86px_1fr] items-center gap-2 rounded-lg border p-2 text-xs ${isDarkMode ? "border-slate-700 bg-slate-900/40 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
              <span>{row.c1}</span>
              <span className="truncate">{row.c2}</span>
              <span className="truncate">{row.c3}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function shortRepo(url = "") {
  const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) return url;
  return match[1].split("/")[1] ?? url;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function weekdayLabel(index) {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  return Number.isInteger(index) && index >= 0 && index < labels.length ? labels[index] : "Cron";
}

function getErrorMessage(error, fallback) {
  if (typeof error?.detail === "string") return error.detail;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}
