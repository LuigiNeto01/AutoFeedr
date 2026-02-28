import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import useMediaQuery from "@mui/material/useMediaQuery";
import { api } from "../lib/api";
import LineOverview from "../components/charts/LineOverview";

const STATUS_KEYS = ["pending", "running", "retry", "failed", "success"];

export default function DashboardPage() {
  const outletContext = useOutletContext();
  const isDarkMode = outletContext?.isDarkMode ?? false;
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load({ background = false } = {}) {
      try {
        if (!background && !hasLoadedOnceRef.current) {
          setLoading(true);
        }
        const [healthData, linkedinJobs, leetcodeJobs] = await Promise.all([
          api.health(),
          api.linkedinJobs(120),
          api.leetcodeJobs({ limit: 120 }),
        ]);

        if (cancelled) return;

        const normalizedLinkedin = (linkedinJobs ?? []).map((item) => ({
          id: `linkedin-${item.id}`,
          source: "linkedin",
          status: normalizeStatus(item.status),
          title: item.topic || "Publicação LinkedIn",
          createdAt: item.created_at,
        }));
        const normalizedLeetcode = (leetcodeJobs ?? []).map((item) => ({
          id: `leetcode-${item.id}`,
          source: "leetcode",
          status: normalizeStatus(item.status),
          title: item.problem_title || item.problem_slug || "Execução LeetCode",
          createdAt: item.created_at,
        }));

        setHealth(healthData);
        setJobs([...normalizedLinkedin, ...normalizedLeetcode].sort(sortByRecent));
        setError("");
        hasLoadedOnceRef.current = true;
      } catch (err) {
        if (cancelled) return;
        if (!hasLoadedOnceRef.current) {
          setError(err?.detail || err?.message || "Falha ao carregar dashboard.");
        }
      } finally {
        if (!cancelled && !background) setLoading(false);
      }
    }

    load({ background: false });
    const timer = setInterval(() => load({ background: true }), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const last24hJobs = useMemo(() => {
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    return jobs.filter((job) => toTimestamp(job.createdAt) >= threshold);
  }, [jobs]);

  const counters = useMemo(() => {
    const base = { pending: 0, running: 0, retry: 0, failed: 0, success: 0 };
    last24hJobs.forEach((job) => {
      if (base[job.status] !== undefined) base[job.status] += 1;
    });
    return base;
  }, [last24hJobs]);
  const chartDataset = useMemo(() => buildChartDataset(last24hJobs), [last24hJobs]);

  const latest = jobs.slice(0, 8);
  const successRate = last24hJobs.length
    ? Math.round((counters.success / last24hJobs.length) * 100)
    : 0;

  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-2">
        <div className={`h-28 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/80" : "bg-slate-200/70"}`} />
        <div className={`h-28 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/80" : "bg-slate-200/70"}`} />
        <div className={`h-72 animate-pulse rounded-2xl md:col-span-2 ${isDarkMode ? "bg-slate-800/80" : "bg-slate-200/70"}`} />
      </section>
    );
  }

  if (error) {
    return (
      <section className={`rounded-2xl border p-6 ${isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
        {error}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className={`rounded-3xl border p-6 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className={`text-xs uppercase tracking-[0.25em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Dashboard</p>
            <h2 className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Painel operacional</h2>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
              Visão das últimas 24 horas com tendência e status dos jobs.
            </p>
          </div>
          <Link
            to="/agendamentos"
            className={`rounded-full px-4 py-2 text-sm font-medium text-white transition ${
              isDarkMode ? "bg-slate-700 hover:bg-slate-600" : "bg-slate-900 hover:bg-slate-700"
            }`}
          >
            Ver agendamentos
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {STATUS_KEYS.map((status) => (
          <KpiCard key={status} label={status.toUpperCase()} value={counters[status]} isDarkMode={isDarkMode} />
        ))}
      </section>

      {isMobile ? (
        <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="mb-4">
            <h3 className={`text-base font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Resumo móvel</h3>
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>No celular, mostramos um resumo no lugar do gráfico.</p>
          </div>
          <div className="space-y-2">
            <InfoPill label="API" value={health?.status === "ok" ? "Online" : "Offline"} isDarkMode={isDarkMode} />
            <InfoPill label="Fila ativa" value={`${counters.pending + counters.running + counters.retry}`} isDarkMode={isDarkMode} />
            <InfoPill label="Sucesso" value={`${successRate}%`} isDarkMode={isDarkMode} />
            <div className={`mt-2 rounded-2xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
              <p className={`mb-2 text-center text-[11px] uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Indicadores
              </p>
              <div className="space-y-1.5">
                {STATUS_KEYS.map((status) => (
                  <StatusRow key={status} status={status} value={counters[status]} isDarkMode={isDarkMode} />
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="mb-4">
            <h3 className={`text-base font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Tendência de execuções</h3>
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Blocos de 1 hora com todos os status.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <LineOverview isDarkMode={isDarkMode} dataset={chartDataset} />
            <aside className="space-y-2">
              <p className={`mb-1 text-center text-[11px] uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                distribuição por status
              </p>
              <InfoPill label="API" value={health?.status === "ok" ? "Online" : "Offline"} isDarkMode={isDarkMode} />
              <InfoPill
                label="Fila ativa"
                value={`${counters.pending + counters.running + counters.retry}`}
                isDarkMode={isDarkMode}
              />
              <InfoPill label="Sucesso" value={`${successRate}%`} isDarkMode={isDarkMode} />
              <div className={`mt-2 rounded-2xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                <p className={`mb-2 text-center text-[11px] uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  Indicadores
                </p>
                <div className="space-y-1.5">
                  {STATUS_KEYS.map((status) => (
                    <StatusRow key={status} status={status} value={counters[status]} isDarkMode={isDarkMode} />
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-3 text-base font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Últimas execuções</h3>
        <div className="space-y-2">
          {latest.length ? (
            latest.map((item) => (
              <div
                key={item.id}
                className={`grid gap-2 rounded-xl border p-3 md:grid-cols-[7rem_1fr_7rem_8rem] ${
                  isDarkMode
                    ? "group relative isolate overflow-hidden border-slate-600 bg-gradient-to-br from-slate-900/96 to-slate-800/90 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.95)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-[0_20px_30px_-20px_rgba(56,189,248,0.28)]"
                    : "group relative isolate overflow-hidden border-slate-200 bg-white/95 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_20px_30px_-20px_rgba(15,23,42,0.30)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-r transition-opacity duration-300 ${
                    isDarkMode
                      ? "from-sky-400/10 via-transparent to-indigo-400/10 opacity-0 group-hover:opacity-100"
                      : "from-sky-500/10 via-transparent to-indigo-500/10 opacity-0 group-hover:opacity-100"
                  }`}
                />
                <p className={`relative z-10 text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{item.source}</p>
                <p className={`relative z-10 truncate text-sm ${isDarkMode ? "text-slate-100" : "text-slate-900"}`} title={item.title}>
                  {item.title}
                </p>
                <p className={`relative z-10 text-xs font-semibold uppercase ${statusColor(item.status)}`}>
                  {item.status}
                </p>
                <p className={`relative z-10 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{formatTime(item.createdAt)}</p>
              </div>
            ))
          ) : (
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Ainda sem execuções registradas.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, isDarkMode }) {
  return (
    <div
      className={`group relative isolate overflow-hidden rounded-2xl border px-4 py-4 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 ${
        isDarkMode
          ? "border-slate-600 bg-gradient-to-br from-slate-900/98 to-slate-800/90 shadow-[0_18px_28px_-20px_rgba(15,23,42,0.95)] hover:border-sky-500/45 hover:shadow-[0_24px_34px_-20px_rgba(56,189,248,0.34)]"
          : "border-slate-200 bg-white shadow-[0_18px_28px_-20px_rgba(15,23,42,0.35)] hover:border-slate-300 hover:shadow-[0_24px_34px_-20px_rgba(15,23,42,0.30)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-r transition-opacity duration-300 ${
          isDarkMode
            ? "from-sky-400/15 via-transparent to-indigo-400/15 opacity-0 group-hover:opacity-100"
            : "from-sky-500/10 via-transparent to-indigo-500/10 opacity-0 group-hover:opacity-100"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-6 -bottom-2 h-5 rounded-full blur-xl transition-opacity duration-300 ${
          isDarkMode
            ? "bg-sky-300/20 opacity-0 group-hover:opacity-70"
            : "bg-sky-500/20 opacity-0 group-hover:opacity-70"
        }`}
      />
      <p className={`relative z-10 text-[11px] uppercase tracking-[0.2em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`relative z-10 mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
      <p className={`relative z-10 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>últimas 24h</p>
    </div>
  );
}

function InfoPill({ label, value, isDarkMode }) {
  return (
    <div
      className={`group relative isolate overflow-hidden rounded-xl border px-3 py-2 text-center text-xs backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 ${
        isDarkMode
          ? "border-slate-600 bg-gradient-to-br from-slate-900/92 to-slate-800/80 shadow-[0_12px_22px_-22px_rgba(15,23,42,0.95)] hover:border-sky-500/40"
          : "border-slate-200 bg-white/95 shadow-[0_12px_22px_-22px_rgba(15,23,42,0.35)] hover:border-slate-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-r transition-opacity duration-300 ${
          isDarkMode
            ? "from-sky-400/10 via-transparent to-indigo-400/10 opacity-0 group-hover:opacity-100"
            : "from-sky-500/10 via-transparent to-indigo-500/10 opacity-0 group-hover:opacity-100"
        }`}
      />
      <span className={`relative z-10 mr-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}:</span>
      <span className={`relative z-10 font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function StatusRow({ status, value, isDarkMode }) {
  const colors = {
    pending: "#64748b",
    running: "#2563eb",
    retry: "#d97706",
    failed: "#dc2626",
    success: "#16a34a",
  };

  return (
    <div
      className={`group relative isolate flex items-center justify-between overflow-hidden rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-300 ease-out hover:-translate-y-0.5 ${
        isDarkMode
          ? "border-slate-600 bg-gradient-to-r from-slate-900/96 to-slate-800/88 shadow-[0_10px_18px_-20px_rgba(15,23,42,0.95)] hover:border-sky-500/40"
          : "border-slate-200 bg-white shadow-[0_10px_18px_-20px_rgba(15,23,42,0.35)] hover:border-slate-300"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-r transition-opacity duration-300 ${
          isDarkMode
            ? "from-sky-400/10 via-transparent to-indigo-400/10 opacity-0 group-hover:opacity-100"
            : "from-sky-500/10 via-transparent to-indigo-500/10 opacity-0 group-hover:opacity-100"
        }`}
      />
      <div className="relative z-10 inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[status] }} />
        <span className={`uppercase ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{status}</span>
      </div>
      <span className={`relative z-10 font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function normalizeStatus(status = "") {
  const allowed = new Set(STATUS_KEYS);
  const value = String(status).toLowerCase();
  return allowed.has(value) ? value : "pending";
}

function statusColor(status) {
  switch (status) {
    case "success":
      return "text-emerald-600";
    case "failed":
      return "text-red-600";
    case "running":
      return "text-blue-600";
    case "retry":
      return "text-amber-600";
    default:
      return "text-slate-600";
  }
}

function formatTime(value) {
  try {
    return new Date(toTimestamp(value)).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function sortByRecent(a, b) {
  return toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
}

function buildChartDataset(jobs) {
  const now = new Date();
  const currentHourStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    0,
    0,
    0,
  ).getTime();
  const oneHourMs = 60 * 60 * 1000;

  const buckets = Array.from({ length: 24 }, (_, index) => {
    const start = currentHourStart - (23 - index) * oneHourMs;
    return {
      date: new Date(start),
      start,
      end: start + oneHourMs,
      pending: 0,
      running: 0,
      retry: 0,
      failed: 0,
      success: 0,
    };
  });

  for (const job of jobs) {
    const createdAt = toTimestamp(job.createdAt);
    const bucket = buckets.find((item) => createdAt >= item.start && createdAt < item.end);
    if (bucket && bucket[job.status] !== undefined) {
      bucket[job.status] += 1;
    }
  }

  return buckets.map((item) => ({
    date: item.date,
    pending: item.pending,
    running: item.running + item.retry,
    failed: item.failed,
    success: item.success,
  }));
}

function toTimestamp(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const hasTimezone = /([zZ]|[+\-]\d{2}:\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
}
