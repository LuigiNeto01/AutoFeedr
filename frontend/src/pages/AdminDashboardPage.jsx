import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

const AUDIT_PAGE_SIZE = 10;

export default function AdminDashboardPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [metricsData, logsData] = await Promise.all([
        api.adminMetricsOverview(),
        api.adminAuditLogs(100),
      ]);
      setMetrics(metricsData);
      setAuditLogs(logsData ?? []);
      setAuditPage(1);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar dashboard admin."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const statusMap = useMemo(
    () => new Map((metrics?.statuses_24h ?? []).map((item) => [item.status, item.count])),
    [metrics],
  );

  const mainStats = useMemo(
    () => [
      { key: "users", label: "Usuários", value: metrics?.users_total ?? 0 },
      { key: "users-active", label: "Usuários ativos", value: metrics?.users_active ?? 0 },
      { key: "success", label: "Success 24h", value: statusMap.get("success") ?? 0 },
      { key: "failed", label: "Failed 24h", value: statusMap.get("failed") ?? 0 },
    ],
    [metrics, statusMap],
  );

  const desktopStats = useMemo(
    () => [
      { key: "jobs", label: "Jobs 24h", value: metrics?.total_jobs_24h ?? 0 },
      {
        key: "schedules",
        label: "Schedules ativos",
        value: (metrics?.linkedin_schedules_active ?? 0) + (metrics?.leetcode_schedules_active ?? 0),
      },
    ],
    [metrics],
  );

  const auditTotalPages = Math.max(1, Math.ceil(auditLogs.length / AUDIT_PAGE_SIZE));

  useEffect(() => {
    if (auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages]);

  const pagedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_PAGE_SIZE;
    return auditLogs.slice(start, start + AUDIT_PAGE_SIZE);
  }, [auditLogs, auditPage]);

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
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Dashboard operacional</h2>
            <p className={`mt-1 text-sm ${sub}`}>Métricas globais (24h) e trilha de auditoria administrativa.</p>
          </div>
          <button
            type="button"
            onClick={() => loadData({ silent: true })}
            className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </section>

      {metrics ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {mainStats.map((item) => (
              <Stat key={item.key} label={item.label} value={item.value} isDarkMode={isDarkMode} />
            ))}
            {desktopStats.map((item) => (
              <div key={item.key} className="hidden sm:block">
                <Stat label={item.label} value={item.value} isDarkMode={isDarkMode} />
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
              <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Status dos jobs (24h)</h3>
              <div className="space-y-2">
                {(metrics.statuses_24h ?? []).map((item) => (
                  <div key={item.status} className={`flex items-center justify-between rounded-xl border px-3 py-2 ${card}`}>
                    <span className={`text-sm capitalize ${txt}`}>{item.status}</span>
                    <span className={`text-sm font-semibold ${txt}`}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
              <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Fluxos (24h)</h3>
              <div className="space-y-3">
                {(metrics.flows_24h ?? []).map((flow) => (
                  <div key={flow.flow} className={`rounded-xl border p-3 ${card}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm font-semibold uppercase tracking-wide ${txt}`}>{flow.flow}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MiniStat label="Success" value={flow.success_24h} isDarkMode={isDarkMode} />
                      <MiniStat label="Failed" value={flow.failed_24h} isDarkMode={isDarkMode} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className={`text-lg font-semibold ${txt}`}>Auditoria admin</h3>
          <span className={`text-xs ${sub}`}>{auditLogs.length} registros</span>
        </div>
        {auditLogs.length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nenhuma ação administrativa registrada ainda.</p>
        ) : (
          <>
            <div className="space-y-2">
              {pagedAuditLogs.map((log) => (
                <div key={log.id} className={`rounded-xl border p-3 ${card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${txt}`}>{log.action}</p>
                      <p className={`truncate text-xs ${sub}`}>
                        admin #{log.admin_user_id ?? "-"} • alvo #{log.target_user_id ?? "-"}
                      </p>
                    </div>
                    <span className={`text-xs ${sub}`}>{formatDate(log.created_at)}</span>
                  </div>
                  {log.details ? (
                    <pre className={`mt-2 overflow-x-auto rounded-lg border p-2 text-xs ${isDarkMode ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-700"}`}>
                      {formatDetails(log.details)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>

            {auditTotalPages > 1 ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className={`text-xs ${sub}`}>Página {auditPage} de {auditTotalPages}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={auditPage === 1}
                    onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${auditPage === 1 ? "cursor-not-allowed opacity-50" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={auditPage === auditTotalPages}
                    onClick={() => setAuditPage((prev) => Math.min(auditTotalPages, prev + 1))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${auditPage === auditTotalPages ? "cursor-not-allowed opacity-50" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            ) : null}
          </>
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

function MiniStat({ label, value, isDarkMode }) {
  return (
    <div className={`rounded-lg border p-2 ${isDarkMode ? "border-slate-700 bg-slate-900/40" : "border-slate-200 bg-white"}`}>
      <p className={`text-[10px] uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
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

function formatDetails(value) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return String(value);
  }
}

function getErrorMessage(error, fallback) {
  if (typeof error?.detail === "string") return error.detail;
  if (typeof error?.message === "string") return error.message;
  return fallback;
}
