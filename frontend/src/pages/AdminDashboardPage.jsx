import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";

export default function AdminDashboardPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [metrics, setMetrics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
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
        api.adminAuditLogs(50),
      ]);
      setMetrics(metricsData);
      setAuditLogs(logsData ?? []);
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

  if (loading) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  const statusMap = new Map((metrics?.statuses_24h ?? []).map((item) => [item.status, item.count]));

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
            <p className={`mt-1 text-sm ${sub}`}>Metricas globais (24h) e trilha de auditoria administrativa.</p>
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
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Usuarios" value={metrics.users_total} isDarkMode={isDarkMode} />
            <Stat label="Usuarios ativos" value={metrics.users_active} isDarkMode={isDarkMode} />
            <Stat label="Jobs 24h" value={metrics.total_jobs_24h} isDarkMode={isDarkMode} />
            <Stat label="Schedules ativos" value={metrics.linkedin_schedules_active + metrics.leetcode_schedules_active} isDarkMode={isDarkMode} />
            <Stat label="Success 24h" value={statusMap.get("success") ?? 0} isDarkMode={isDarkMode} />
            <Stat label="Failed 24h" value={statusMap.get("failed") ?? 0} isDarkMode={isDarkMode} />
            <Stat label="Retry 24h" value={statusMap.get("retry") ?? 0} isDarkMode={isDarkMode} />
            <Stat label="Running/Pending" value={`${statusMap.get("running") ?? 0}/${statusMap.get("pending") ?? 0}`} isDarkMode={isDarkMode} />
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className={`text-lg font-semibold ${txt}`}>Auditoria admin</h3>
          <span className={`text-xs ${sub}`}>{auditLogs.length} registros</span>
        </div>
        {auditLogs.length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Nenhuma acao administrativa registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
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
