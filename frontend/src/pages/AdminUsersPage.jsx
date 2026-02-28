import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

const ROLE_OPTIONS = ["all", "user", "admin"];

export default function AdminUsersPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [overview, setOverview] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  async function loadUsers({ silent = false, preserveSelection = true } = {}) {
    if (silent) setRefreshingUsers(true);
    else setLoadingUsers(true);

    try {
      const data = await api.adminUsers();
      setUsers(data ?? []);
      setError("");
      setSelectedUserId((prev) => {
        if (!data?.length) return null;
        if (preserveSelection && prev && data.some((item) => item.id === prev)) return prev;
        return data[0].id;
      });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar usuários admin."));
    } finally {
      if (silent) setRefreshingUsers(false);
      else setLoadingUsers(false);
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
      setError(getErrorMessage(err, "Falha ao carregar visão detalhada do usuário."));
    } finally {
      setLoadingOverview(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (isModalOpen && selectedUserId != null) loadOverview(selectedUserId);
  }, [isModalOpen, selectedUserId]);

  const filteredUsers = useMemo(() => {
    const text = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!text) return true;
      const combined = `${user.email} ${user.id}`.toLowerCase();
      return combined.includes(text);
    });
  }, [users, search, roleFilter]);

  const selectedUser = useMemo(() => {
    return users.find((item) => item.id === selectedUserId) ?? overview?.user ?? null;
  }, [users, selectedUserId, overview]);

  const openDetails = (user) => {
    setSelectedUserId(user.id);
    setIsModalOpen(true);
  };

  const closeDetails = () => {
    setIsModalOpen(false);
    setOverview(null);
  };

  const handleToggleActive = async () => {
    const user = overview?.user;
    if (!user || saving) return;

    const nextActive = !user.is_active;
    const shouldProceed = window.confirm(
      nextActive
        ? `Reativar usuário ${user.email}?`
        : `Bloquear usuário ${user.email}? Isso também desativa agendamentos e revoga tokens ativos.`,
    );
    if (!shouldProceed) return;

    setSaving(true);
    try {
      await api.adminUpdateUser(user.id, { is_active: nextActive });
      await loadUsers({ silent: true, preserveSelection: true });
      await loadOverview(user.id);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar status do usuário."));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (nextRole) => {
    const user = overview?.user;
    if (!user || saving || !nextRole || user.role === nextRole) return;
    setSaving(true);
    try {
      await api.adminUpdateUser(user.id, { role: nextRole });
      await loadUsers({ silent: true, preserveSelection: true });
      await loadOverview(user.id);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar papel do usuário."));
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
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Usuários</h2>
            <p className={`mt-1 text-sm ${sub}`}>Gestão de acesso com visualização detalhada em modal.</p>
          </div>
          <button
            type="button"
            onClick={() => loadUsers({ silent: true, preserveSelection: true })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {refreshingUsers ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por email ou ID"
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`}
          />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className={`rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role === "all" ? "Todos os papéis" : role}
              </option>
            ))}
          </select>
          <div className={`rounded-xl border px-3 py-2 text-sm ${card}`}>
            <p className={`text-xs uppercase tracking-wide ${sub}`}>Visíveis</p>
            <p className={`mt-1 text-lg font-semibold ${txt}`}>{filteredUsers.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filteredUsers.map((user) => (
          <article
            key={user.id}
            className={`rounded-2xl border p-4 shadow-sm transition ${card} ${isDarkMode ? "hover:border-sky-500/40" : "hover:border-slate-400"}`}
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
            <p className={`mt-3 text-xs ${sub}`}>Criado em {formatDate(user.created_at)}</p>
            <button
              type="button"
              onClick={() => openDetails(user)}
              className={`mt-3 w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}
            >
              Visualizar
            </button>
          </article>
        ))}
      </section>

      {filteredUsers.length === 0 ? (
        <section className={`rounded-2xl border p-4 text-sm shadow-sm ${panel} ${sub}`}>
          Nenhum usuário encontrado para os filtros atuais.
        </section>
      ) : null}

      {isModalOpen ? (
        <UserOverviewModal
          isDarkMode={isDarkMode}
          panel={panel}
          card={card}
          txt={txt}
          sub={sub}
          user={selectedUser}
          overview={overview}
          loading={loadingOverview}
          saving={saving}
          onClose={closeDetails}
          onToggleActive={handleToggleActive}
          onRoleChange={handleRoleChange}
        />
      ) : null}
    </div>
  );
}

function UserOverviewModal({
  isDarkMode,
  card,
  txt,
  sub,
  user,
  overview,
  loading,
  saving,
  onClose,
  onToggleActive,
  onRoleChange,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/60" aria-label="Fechar" />
      <div className={`popup-surface ${isDarkMode ? "popup-surface-dark" : "popup-surface-light"} relative z-10 flex h-[96dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border shadow-xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl`}>
        <div className={`shrink-0 border-b px-3 py-3 sm:px-4 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={`text-xs uppercase tracking-[0.18em] ${sub}`}>Usuário</p>
            <h3 className={`text-lg font-semibold ${txt}`}>{user?.email ?? "-"}</h3>
            <p className={`text-xs ${sub}`}>ID #{user?.id ?? "-"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-3 py-1.5 text-sm ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
          >
            Fechar
          </button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">

        {loading ? <div className={`h-60 animate-pulse rounded-xl ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} /> : null}

        {!loading && overview ? (
          <div className="space-y-4">
            <section className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-3 ${card}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={overview.user.is_active ? "green" : "red"} text={overview.user.is_active ? "Ativo" : "Bloqueado"} isDarkMode={isDarkMode} />
                  <Badge tone={overview.user.role === "admin" ? "blue" : "gray"} text={overview.user.role} isDarkMode={isDarkMode} />
                  <span className={`text-xs ${sub}`}>Criado em {formatDate(overview.user.created_at)}</span>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <select
                    value={overview.user.role}
                    disabled={saving}
                    onChange={(event) => onRoleChange(event.target.value)}
                    className={`rounded-lg border px-3 py-2 text-sm ${isDarkMode ? "border-slate-600 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onToggleActive}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                      overview.user.is_active ? "bg-red-700 hover:bg-red-600" : "bg-emerald-700 hover:bg-emerald-600"
                    }`}
                  >
                    {overview.user.is_active ? "Bloquear" : "Desbloquear"}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Contas LinkedIn" value={overview.counts.linkedin_accounts} isDarkMode={isDarkMode} />
              <Stat label="Contas GitHub" value={overview.counts.github_accounts} isDarkMode={isDarkMode} />
              <Stat label="Repositórios" value={overview.counts.github_repositories} isDarkMode={isDarkMode} />
              <Stat label="Agendamentos" value={overview.counts.linkedin_schedules + overview.counts.leetcode_schedules} isDarkMode={isDarkMode} />
              <Stat label="Jobs LinkedIn" value={overview.counts.linkedin_jobs} isDarkMode={isDarkMode} />
              <Stat label="Jobs LeetCode" value={overview.counts.leetcode_jobs} isDarkMode={isDarkMode} />
              <Stat label="Chave OpenAI" value={overview.user.has_openai_api_key ? "Sim" : "Não"} isDarkMode={isDarkMode} />
              <Stat label="Status" value={overview.user.is_active ? "Ativo" : "Bloqueado"} isDarkMode={isDarkMode} />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
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
                title="Repositórios"
                items={overview.github_repositories.map((item) => ({
                  id: item.id,
                  title: shortRepo(item.repo_ssh_url),
                  subtitle: item.repo_ssh_url,
                  active: item.is_active,
                }))}
                emptyText="Nenhum repositório."
                isDarkMode={isDarkMode}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
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
            </section>
          </div>
        ) : null}

        {!loading && !overview ? (
          <p className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-4 text-sm ${card} ${sub}`}>Não foi possível carregar os detalhes deste usuário.</p>
        ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, isDarkMode }) {
  return (
    <div className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
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
    <section className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50/80"}`}>
      <h4 className={`mb-3 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h4>
      {items.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-lg border p-2 ${isDarkMode ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{item.title}</p>
                  <p className={`break-all text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{item.subtitle}</p>
                </div>
                {typeof item.active === "boolean" ? (
                  <Badge tone={item.active ? "green" : "red"} text={item.active ? "Ativo" : "Inativo"} isDarkMode={isDarkMode} />
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
    <section className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50/80"}`}>
      <h4 className={`mb-3 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h4>
      {rows.length === 0 ? (
        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} grid grid-cols-1 gap-1 rounded-lg border p-2 text-xs sm:grid-cols-[56px_86px_1fr] sm:items-center sm:gap-2 ${isDarkMode ? "border-slate-700 bg-slate-900/40 text-slate-200" : "border-slate-200 bg-white text-slate-700"}`}>
              <span>{row.c1}</span>
              <span className="truncate">{row.c2}</span>
              <span className="break-all">{row.c3}</span>
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
  return match[1];
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

function getErrorMessage(error, fallback) {
  if (typeof error?.detail === "string") return error.detail;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}
