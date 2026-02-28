import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

const FILTERS = { job_type: "", status: "", user_id: "" };
const PAGE_SIZE = 20;

export default function AdminExecutionsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedJob, setSelectedJob] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLogs, setDetailLogs] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

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
      setError(getErrorMessage(err, "Falha ao carregar execuções globais."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadUsers(), loadJobs()]).catch((err) => {
      if (!cancelled) setError(getErrorMessage(err, "Falha ao carregar dados admin."));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) loadJobs({ silent: true });
  }, [filters.job_type, filters.status, filters.user_id]);

  useEffect(() => {
    setPage(1);
  }, [filters.job_type, filters.status, filters.user_id]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      failed: jobs.filter((item) => item.status === "failed").length,
      running: jobs.filter((item) => item.status === "running").length,
      success: jobs.filter((item) => item.status === "success").length,
    };
  }, [jobs]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return jobs.slice(start, start + PAGE_SIZE);
  }, [jobs, page]);

  async function openDetails(job) {
    setSelectedJob(job);
    setDetailData(null);
    setDetailLogs(null);
    setDetailError("");
    setLoadingDetail(true);

    try {
      const kind = resolveKind(job.job_type);
      if (kind === "linkedin") {
        const data = await api.linkedinJob(job.job_id).catch(() => null);
        setDetailData(data);
      } else {
        const [data, logs] = await Promise.all([
          api.leetcodeJob(job.job_id).catch(() => null),
          api.leetcodeJobLogs(job.job_id).catch(() => null),
        ]);
        setDetailData(data);
        setDetailLogs(logs);
      }
    } catch (err) {
      setDetailError(getErrorMessage(err, "Falha ao carregar detalhes da execução."));
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetails() {
    setSelectedJob(null);
    setDetailData(null);
    setDetailLogs(null);
    setDetailError("");
    setLoadingDetail(false);
  }

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
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Execuções globais</h2>
            <p className={`mt-1 text-sm ${sub}`}>Visão unificada de jobs LinkedIn e LeetCode por usuário.</p>
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
        <Stat label="Visíveis" value={stats.total} isDarkMode={isDarkMode} />
        <Stat label="Success" value={stats.success} isDarkMode={isDarkMode} />
        <Stat label="Running" value={stats.running} isDarkMode={isDarkMode} />
        <Stat label="Failed" value={stats.failed} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={filters.job_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, job_type: event.target.value }))}
            className={`rounded-xl border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
          >
            <option value="">Todos os fluxos</option>
            <option value="linkedin">LinkedIn</option>
            <option value="leetcode">LeetCode</option>
          </select>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
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
            onChange={(event) => setFilters((prev) => ({ ...prev, user_id: event.target.value }))}
            className={`rounded-xl border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`}
          >
            <option value="">Todos os usuários</option>
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
        <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Tabela de execuções</h3>
        {jobs.length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nenhuma execução encontrada para os filtros atuais.</p>
        ) : (
          <div className="space-y-2">
            {pagedJobs.map((job) => (
              <article key={`${job.job_type}-${job.job_id}`} className={`rounded-xl border p-3 ${card}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${txt}`}>
                      {String(job.job_type || "").toUpperCase()} #{job.job_id}
                    </p>
                    <p className={`truncate text-xs ${sub}`}>
                      Usuário: {job.owner_user_email ?? `#${job.owner_user_id ?? "-"}`}
                    </p>
                    <p className={`truncate text-xs ${sub}`}>Destino: {formatTarget(job)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={job.status} isDarkMode={isDarkMode} />
                    <span className={`text-xs ${sub}`}>{formatDate(job.created_at)}</span>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <p className={`truncate text-xs ${sub}`}>Assunto: {job.subject || "-"}</p>
                  <p className={`text-xs ${sub}`}>Tentativas: {job.attempts}/{job.max_attempts}</p>
                  <p className={`truncate text-xs ${sub}`}>Origem: {job.source}</p>
                  <p className={`text-xs ${sub}`}>Agendado: {formatDate(job.scheduled_for)}</p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => openDetails(job)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}
                  >
                    Detalhar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {jobs.length > 0 && totalPages > 1 ? (
        <section className={`rounded-2xl border p-3 shadow-sm ${panel}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${sub}`}>Página {page} de {totalPages}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === 1 ? "cursor-not-allowed opacity-50" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === totalPages ? "cursor-not-allowed opacity-50" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedJob ? (
        <ExecutionDetailModal
          isDarkMode={isDarkMode}
          job={selectedJob}
          detail={detailData}
          logs={detailLogs}
          loading={loadingDetail}
          error={detailError}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
}

function ExecutionDetailModal({ isDarkMode, job, detail, logs, loading, error, onClose }) {
  const kind = resolveKind(job.job_type);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/60" aria-label="Fechar" />
      <div className={`popup-surface ${isDarkMode ? "popup-surface-dark" : "popup-surface-light"} relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-4 shadow-xl`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
            Execução {String(job.job_type || "").toUpperCase()} #{job.job_id}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-3 py-1.5 text-sm ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
          >
            Fechar
          </button>
        </div>

        {loading ? <div className={`h-40 animate-pulse rounded-xl ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} /> : null}
        {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Info label="Status" value={job.status || "-"} isDarkMode={isDarkMode} />
          <Info label="Usuário" value={job.owner_user_email ?? `#${job.owner_user_id ?? "-"}`} isDarkMode={isDarkMode} />
          <Info label="Destino" value={formatTarget(job)} isDarkMode={isDarkMode} />
          <Info label="Agendado" value={formatDate(job.scheduled_for)} isDarkMode={isDarkMode} />
          <Info label="Criado" value={formatDate(job.created_at)} isDarkMode={isDarkMode} />
          <Info label="Tentativas" value={`${job.attempts}/${job.max_attempts}`} isDarkMode={isDarkMode} />
        </div>

        {job.error_message ? (
          <section className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} mt-3 rounded-xl border p-3 ${isDarkMode ? "border-red-900/50 bg-red-950/30 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">Erro</p>
            <p className="mt-1 text-sm">{job.error_message}</p>
          </section>
        ) : null}

        {!loading && detail ? (
          <section className="mt-3 space-y-3">
            {kind === "linkedin" ? (
              <>
                <Block title="Tópico" value={detail.topic || "-"} isDarkMode={isDarkMode} />
                <Block title="Paper URL" value={detail.paper_url || "-"} isDarkMode={isDarkMode} />
                <Block title="Post gerado" value={detail.generated_post || "-"} isDarkMode={isDarkMode} />
              </>
            ) : (
              <>
                <Block title="Problema" value={detail.problem_title || detail.problem_slug || "-"} isDarkMode={isDarkMode} />
                <Block title="Commit SHA" value={detail.commit_sha || "-"} isDarkMode={isDarkMode} mono />
                <Block title="Mensagem do commit" value={detail.commit_message || "-"} isDarkMode={isDarkMode} />
              </>
            )}
          </section>
        ) : null}

        {!loading && kind === "leetcode" && logs ? (
          <section className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} mt-3 rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
            <h4 className={`mb-2 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Logs</h4>
            <pre className={`max-h-[320px] overflow-auto rounded-lg border p-2 text-xs ${isDarkMode ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-700"}`}>
              {formatLogs(logs)}
            </pre>
          </section>
        ) : null}
      </div>
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

function Info({ label, value, isDarkMode }) {
  return (
    <div className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border px-3 py-2 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-[11px] uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Block({ title, value, isDarkMode, mono = false }) {
  return (
    <div className={`popup-card ${isDarkMode ? "popup-card-dark" : "popup-card-light"} rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`mb-1 text-[11px] uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{title}</p>
      <p className={`${mono ? "font-mono" : ""} whitespace-pre-wrap break-words text-sm ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Message({ tone, text, isDarkMode }) {
  const styles = tone === "error"
    ? isDarkMode
      ? "border-red-900/60 bg-red-950/40 text-red-200"
      : "border-red-200 bg-red-50 text-red-700"
    : isDarkMode
      ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{text}</div>;
}

function resolveKind(jobType) {
  const raw = String(jobType || "").toLowerCase();
  return raw.includes("leetcode") ? "leetcode" : "linkedin";
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
  if (resolveKind(job.job_type) !== "leetcode") return job.target;
  const match = String(job.target).match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) return job.target;
  return match[1];
}

function formatLogs(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function getErrorMessage(error, fallback) {
  if (typeof error?.detail === "string") return error.detail;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}
