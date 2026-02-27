import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function ResultsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [linkedinJobs, setLinkedinJobs] = useState([]);
  const [leetcodeJobs, setLeetcodeJobs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [liJobs, lcJobs, liAccounts, ghRepos] = await Promise.all([
        api.linkedinJobs(200),
        api.leetcodeJobs({ limit: 200 }),
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
      title: item.topic || "Sem topico",
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
      subtitle: repoById.get(item.repository_id) ?? `Repositorio #${item.repository_id}`,
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

  if (loading) return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;

  return (
    <div className="space-y-5">
      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Execucao</p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Resultados</h2>
          </div>
          <button type="button" onClick={() => loadData({ silent: true })} className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Posts publicados" value={publishedPosts.length} isDarkMode={isDarkMode} />
        <StatCard label="Problemas concluidos" value={completedProblems.length} isDarkMode={isDarkMode} />
        <StatCard label="Contas LinkedIn" value={accounts.length} isDarkMode={isDarkMode} />
        <StatCard label="Repos monitorados" value={repositories.length} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="grid gap-3 md:grid-cols-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por titulo, slug, conteudo..." className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={`rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}>
            <option value="all">Tudo</option>
            <option value="linkedin">LinkedIn</option>
            <option value="leetcode">LeetCode</option>
          </select>
        </div>
      </section>

      <section>
        <ResultList title="Execucoes" empty="Nenhuma execucao encontrada." items={filteredResults} isDarkMode={isDarkMode} renderItem={(item) => (
          <>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>#{item.id} - {item.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${item.kind === "linkedin" ? (isDarkMode ? "bg-sky-700/40 text-sky-200" : "bg-sky-100 text-sky-700") : (isDarkMode ? "bg-emerald-700/40 text-emerald-200" : "bg-emerald-100 text-emerald-700")}`}>
                {item.kind}
              </span>
            </div>
            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{item.subtitle}</p>
            <p className={`mt-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{item.body}</p>
            <p className={`mt-2 text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>{formatDate(item.updatedAt)}</p>
            <Link to={`/resultados/${item.kind}/${item.id}`} state={{ prefetchedJob: item.raw }} className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}>Detalhar</Link>
          </>
        )} />
      </section>
    </div>
  );
}

function ResultList({ title, empty, items, renderItem, isDarkMode }) {
  return <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
    <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
    {items.length === 0 ? <div className={`rounded-xl border border-dashed px-4 py-8 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>{empty}</div> : <div className="space-y-3">{items.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>{renderItem(item)}</article>)}</div>}
  </section>;
}

function StatCard({ label, value, isDarkMode }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}><p className={`text-xs uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p><p className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p></div>;
}

function Message({ tone, text, isDarkMode }) {
  const styles = tone === "error" ? isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700" : isDarkMode ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{text}</div>;
}

function shortSha(value) {
  if (!value) return "-";
  return String(value).slice(0, 8);
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}
