import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const PAGE_SIZE = 20;

export default function ResultsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [page, setPage] = useState(1);
  const [linkedinJobs, setLinkedinJobs] = useState([]);
  const [leetcodeJobs, setLeetcodeJobs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [liJobs, lcJobs, liAccounts, ghRepos] = await Promise.all([
        api.linkedinJobs(500),
        api.leetcodeJobs({ limit: 500 }),
        api.linkedinAccounts(),
        api.githubRepositories(),
      ]);
      setLinkedinJobs(liJobs ?? []);
      setLeetcodeJobs(lcJobs ?? []);
      setAccounts(liAccounts ?? []);
      setRepositories(ghRepos ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar resultados."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const accountById = useMemo(() => new Map(accounts.map((item) => [item.id, item.name])), [accounts]);
  const repoById = useMemo(() => new Map(repositories.map((item) => [item.id, item.repo_ssh_url])), [repositories]);

  const publishedPosts = useMemo(
    () => linkedinJobs.filter((job) => job.status === "success" && job.generated_post),
    [linkedinJobs],
  );
  const completedProblems = useMemo(
    () => leetcodeJobs.filter((job) => job.status === "success"),
    [leetcodeJobs],
  );

  const allResults = useMemo(() => {
    const posts = publishedPosts.map((item) => ({
      uid: `linkedin-${item.id}`,
      kind: "linkedin",
      id: item.id,
      title: item.topic || "Sem tópico",
      subtitle: accountById.get(item.account_id) ?? `Conta #${item.account_id}`,
      body: item.generated_post || "-",
      updatedAt: item.updated_at,
      raw: item,
    }));

    const problems = completedProblems.map((item) => ({
      uid: `leetcode-${item.id}`,
      kind: "leetcode",
      id: item.id,
      title: item.problem_title || item.problem_slug || "LeetCode job",
      subtitle: repoById.get(item.repository_id) ?? `Repositório #${item.repository_id}`,
      body: `Commit: ${shortSha(item.commit_sha)}`,
      updatedAt: item.updated_at,
      raw: item,
    }));

    return [...posts, ...problems].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [publishedPosts, completedProblems, accountById, repoById]);

  const filteredResults = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return allResults.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      const text = `${item.title} ${item.subtitle} ${item.body}`.toLowerCase();
      return !searchLower || text.includes(searchLower);
    });
  }, [allResults, kind, search]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [kind, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredResults.slice(start, start + PAGE_SIZE);
  }, [filteredResults, page]);

  if (loading) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  return (
    <div className="space-y-5">
      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Execução</p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Resultados</h2>
          </div>
          <button type="button" onClick={() => loadData({ silent: true })} className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
        <StatCard label="Posts publicados" value={publishedPosts.length} isDarkMode={isDarkMode} />
        <StatCard label="Problemas concluídos" value={completedProblems.length} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, slug, conteúdo..." className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}>
            <option value="all">Tudo</option>
            <option value="linkedin">LinkedIn</option>
            <option value="leetcode">LeetCode</option>
          </select>
        </div>
      </section>

      <section>
        <ResultList title="Execuções" empty="Nenhuma execução encontrada." items={pagedResults} isDarkMode={isDarkMode} renderItem={(item) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>#{item.id} - {item.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.kind === "linkedin" ? (isDarkMode ? "bg-sky-700/40 text-sky-200" : "bg-sky-100 text-sky-700") : (isDarkMode ? "bg-emerald-700/40 text-emerald-200" : "bg-emerald-100 text-emerald-700")}`}>
                {item.kind}
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{item.subtitle}</p>
            <p className={`mt-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              {item.kind === "linkedin" ? truncateText(item.body, 100) : item.body}
            </p>
            <p className={`mt-2 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{formatDate(item.updatedAt)}</p>
            <button type="button" onClick={() => setSelectedResult(item)} className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}>Detalhar</button>
          </>
        )} />
      </section>

      {totalPages > 1 ? (
        <section className={`rounded-2xl border p-3 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button type="button" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === 1 ? "opacity-50 cursor-not-allowed" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}>Anterior</button>
            {Array.from({ length: totalPages }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  key={`page-${value}`}
                  type="button"
                  onClick={() => setPage(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === value ? (isDarkMode ? "bg-sky-600 text-white" : "bg-slate-900 text-white") : (isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800")}`}
                >
                  {value}
                </button>
              );
            })}
            <button type="button" disabled={page === totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${page === totalPages ? "opacity-50 cursor-not-allowed" : ""} ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}>Próxima</button>
          </div>
        </section>
      ) : null}

      {selectedResult ? (
        <ResultDetailModal
          isDarkMode={isDarkMode}
          item={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      ) : null}
    </div>
  );
}

function ResultDetailModal({ isDarkMode, item, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState(item?.raw ?? null);
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!item) return;
      setLoading(true);
      try {
        let detail = item.raw ?? null;
        if (!detail) {
          detail = item.kind === "linkedin" ? await api.linkedinJob(item.id) : await api.leetcodeJob(item.id);
        }

        let logsData = null;
        if (item.kind === "leetcode") {
          try {
            logsData = await api.leetcodeJobLogs(item.id);
          } catch {
            logsData = null;
          }
        }

        if (!cancelled) {
          setJob(detail);
          setLogs(logsData);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Falha ao carregar detalhamento da execução."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [item]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/60" aria-label="Fechar" />
      <div className={`relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Detalhamento da execução</h3>
          <button type="button" onClick={onClose} className={`rounded-lg px-3 py-1.5 text-sm ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}>Fechar</button>
        </div>

        {loading ? <div className={`h-40 animate-pulse rounded-xl ${isDarkMode ? "bg-slate-800" : "bg-slate-100"}`} /> : null}
        {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

        {!loading && !error && job ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Info label="ID" value={`#${job.id ?? "-"}`} isDarkMode={isDarkMode} />
              <Info label="Tipo" value={item.kind} isDarkMode={isDarkMode} />
              <Info label="Status" value={job.status ?? "-"} isDarkMode={isDarkMode} />
              <Info label="Atualizado em" value={formatDate(job.updated_at)} isDarkMode={isDarkMode} />
            </div>

            {item.kind === "linkedin" ? (
              <>
                <Block title="Tópico" value={job.topic || "-"} isDarkMode={isDarkMode} />
                <Block title="Paper URL" value={job.paper_url || "-"} isDarkMode={isDarkMode} />
                <Block title="Post gerado" value={job.generated_post || "-"} isDarkMode={isDarkMode} />
              </>
            ) : (
              <>
                <Block title="Problema" value={job.problem_title || job.problem_slug || "-"} isDarkMode={isDarkMode} />
                <Block title="Commit SHA" value={job.commit_sha || "-"} isDarkMode={isDarkMode} mono />
                <Block title="Mensagem de commit" value={job.commit_message || "-"} isDarkMode={isDarkMode} />
              </>
            )}

            <Block title="Erro" value={job.error_message || "-"} isDarkMode={isDarkMode} />

            {item.kind === "leetcode" && logs ? (
              <section className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                <h4 className={`mb-2 text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Logs</h4>
                <pre className={`max-h-[320px] overflow-auto rounded-lg border p-2 text-xs ${isDarkMode ? "border-slate-700 bg-slate-950 text-slate-300" : "border-slate-200 bg-white text-slate-700"}`}>
                  {formatLogs(logs)}
                </pre>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultList({ title, empty, items, renderItem, isDarkMode }) {
  return <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
    <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
    {items.length === 0 ? <div className={`rounded-xl border border-dashed px-4 py-8 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>{empty}</div> : <div className="space-y-3">{items.map((item) => <article key={item.uid} className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>{renderItem(item)}</article>)}</div>}
  </section>;
}

function StatCard({ label, value, isDarkMode }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}><p className={`text-xs uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p><p className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p></div>;
}

function Message({ tone, text, isDarkMode }) {
  const styles = tone === "error" ? isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700" : isDarkMode ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{text}</div>;
}

function Info({ label, value, isDarkMode }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-[11px] uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Block({ title, value, isDarkMode, mono = false }) {
  return (
    <div className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`mb-1 text-[11px] uppercase tracking-[0.16em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{title}</p>
      <p className={`${mono ? "font-mono" : ""} whitespace-pre-wrap break-words text-sm ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function shortSha(value) {
  if (!value) return "-";
  return String(value).slice(0, 8);
}

function truncateText(value, maxChars) {
  const raw = String(value || "");
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, maxChars)}...`;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function formatLogs(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}
