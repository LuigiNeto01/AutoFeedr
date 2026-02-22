import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function AutomationsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [linkedinSchedules, setLinkedinSchedules] = useState([]);
  const [leetcodeSchedules, setLeetcodeSchedules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [liSchedules, lcSchedules, liAccounts, ghRepositories] = await Promise.all([
        api.linkedinSchedules(),
        api.leetcodeSchedules(),
        api.linkedinAccounts(),
        api.githubRepositories(),
      ]);
      setLinkedinSchedules(liSchedules ?? []);
      setLeetcodeSchedules(lcSchedules ?? []);
      setAccounts(liAccounts ?? []);
      setRepositories(ghRepositories ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar automacoes."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo(() => {
    const accountById = new Map(accounts.map((item) => [item.id, item.name]));
    const repoById = new Map(repositories.map((item) => [item.id, item.repo_ssh_url]));

    const linkedinRows = linkedinSchedules.map((item) => ({
      id: `linkedin-${item.id}`,
      kind: "LinkedIn",
      title: item.topic || `Rotina #${item.id}`,
      destination: accountById.get(item.account_id) ?? `Conta #${item.account_id}`,
      active: item.is_active,
      schedule: item.cron_expr,
      updatedAt: item.updated_at,
    }));

    const leetcodeRows = leetcodeSchedules.map((item) => ({
      id: `leetcode-${item.id}`,
      kind: "LeetCode",
      title: `Schedule #${item.id}`,
      destination: repoById.get(item.repository_id) ?? `Repositorio #${item.repository_id}`,
      active: item.is_active,
      schedule: item.cron_expr,
      updatedAt: item.updated_at,
    }));

    return [...linkedinRows, ...leetcodeRows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [accounts, linkedinSchedules, leetcodeSchedules, repositories]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((item) => item.active).length;
    return { total, active, inactive: total - active };
  }, [rows]);

  if (loading) {
    return (
      <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
          {error}
        </div>
      ) : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Execucao
            </p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              Automacoes
            </h2>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Catalogo unificado das rotinas configuradas no AutoFeedr.
            </p>
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

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} isDarkMode={isDarkMode} />
        <StatCard label="Ativas" value={stats.active} isDarkMode={isDarkMode} />
        <StatCard label="Inativas" value={stats.inactive} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        {rows.length === 0 ? (
          <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
            Nenhuma automacao encontrada.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 transition ${isDarkMode ? "border-slate-700 bg-slate-800/60 hover:bg-slate-800" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className={`text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                      {item.title}
                    </h3>
                    <p className={`mt-0.5 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                      {item.destination}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${item.active ? (isDarkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>
                    {item.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className={`space-y-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  <p>Tipo: {item.kind}</p>
                  <p className="break-all">Frequencia: {item.schedule || "-"}</p>
                  <p>Atualizada em: {formatDate(item.updatedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, isDarkMode }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <p className={`text-xs uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError) {
    const detail = err.detail;
    if (typeof detail === "string") return detail || fallback;
  }
  return err?.message || fallback;
}
