import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

const FILTERS = { job_type: "", status: "", user_id: "" };

export default function AdminExecutionsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(FILTERS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  async function loadUsers() {
    const data = await api.adminUsers();
    setUsers(data ?? []);
  }

  async function loadJobs({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.adminJobs({
        limit: 200,
        job_type: filters.job_type || undefined,
        status: filters.status || undefined,
        user_id: filters.user_id ? Number(filters.user_id) : undefined,
      });
      setJobs(data ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar execucoes globais."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadUsers(), loadJobs()])
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Falha ao carregar dados admin."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) loadJobs({ silent: true });
  }, [filters.job_type, filters.status, filters.user_id]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      failed: jobs.filter((item) => item.status === "failed").length,
      running: jobs.filter((item) => item.status === "running").length,
      success: jobs.filter((item) => item.status === "success").length,
    };
  }, [jobs]);

  if (loading) {
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
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Execucoes globais</h2>
            <p className={`mt-1 text-sm ${sub}`}>Visao unificada de jobs LinkedIn e LeetCode por usuario.</p>
          </div>
          <button
            type="button"
            onClick={() => loadJobs({ silent: true })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visiveis" value={stats.total} isDarkMode={isDarkMode} />
        <Stat label="Success" value={stats.success} isDarkMode={isDarkMode} />
        <Stat label="Running" value={stats.running} isDarkMode={isDarkMode} />
        <Stat label="Failed" value={stats.failed} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={filters.job_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, job_type: e.target.value }))}
            className={`rounded-xl border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
          >
            <option value="">Todos os fluxos</option>
            <option value="linkedin">LinkedIn</option>
            <option value="leetcode">LeetCode</option>
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className={`rounded-xl border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
          >
            <option value="">Todos os status</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="retry">retry</option>
            <option value="failed">failed</option>
            <option value="success">success</option>
          </select>
          <select
            value={filters.user_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, user_id: e.target.value }))}
            className={`rounded-xl border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
          >
            <option value="">Todos os usuarios</option>
            {users.map((user) => (
              <option key={user.id} value={String(user.id)}>
                #{user.id} - {user.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setFilters(FILTERS)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-700 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Tabela de execucoes</h3>
        {jobs.length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nenhuma execucao encontrada para os filtros atuais.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <article key={`${job.job_type}-${job.job_id}`} className={`rounded-xl border p-3 ${card}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${txt}`}>
                      {job.job_type.toUpperCase()} #{job.job_id}
                    </p>
                    <p className={`truncate text-xs ${sub}`}>
                      Usuario: {job.owner_user_email ?? `#${job.owner_user_id ?? "-"}`}
                    </p>
                    <p className={`truncate text-xs ${sub}`}>
                      Destino: {formatTarget(job)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={job.status} isDarkMode={isDarkMode} />
                    <span className={`text-xs ${sub}`}>{formatDate(job.created_at)}</span>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p className={`truncate text-xs ${sub}`}>Assunto: {job.subject || "-"}</p>
                  <p className={`text-xs ${sub}`}>Tentativas: {job.attempts}/{job.max_attempts}</p>
                  <p className={`truncate text-xs ${sub}`}>Source: {job.source}</p>
                  <p className={`text-xs ${sub}`}>Agendado: {formatDate(job.scheduled_for)}</p>
                </div>
                {job.error_message ? (
                  <p className={`mt-2 rounded-lg border px-2 py-1 text-xs ${isDarkMode ? "border-red-900/50 bg-red-950/30 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
                    {job.error_message}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
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

function Badge({ status, isDarkMode }) {
  const tones = {
    success: isDarkMode ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700",
    failed: isDarkMode ? "bg-red-500/15 text-red-300" : "bg-red-100 text-red-700",
    retry: isDarkMode ? "bg-amber-500/15 text-amber-300" : "bg-amber-100 text-amber-700",
    running: isDarkMode ? "bg-sky-500/15 text-sky-300" : "bg-sky-100 text-sky-700",
    pending: isDarkMode ? "bg-slate-700 text-slate-200" : "bg-slate-200 text-slate-700",
  };
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${tones[status] || tones.pending}`}>{status}</span>;
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

function formatTarget(job) {
  if (!job?.target) return "-";
  if (job.job_type !== "leetcode") return job.target;
  const match = String(job.target).match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) return job.target;
  return match[1];
}

function getErrorMessage(error, fallback) {
  if (typeof error?.detail === "string") return error.detail;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}
