import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useOutletContext, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function ResultDetailPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const location = useLocation();
  const { kind, id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [job, setJob] = useState(null);
  const [logs, setLogs] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);

  const normalizedKind = kind === "leetcode" ? "leetcode" : kind === "linkedin" ? "linkedin" : "";
  const numericId = Number(id);
  const prefetchedJob = location.state?.prefetchedJob ?? null;
  const canUsePrefetched = prefetchedJob && Number(prefetchedJob.id) === numericId;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!normalizedKind || !Number.isInteger(numericId) || numericId <= 0) {
        setError("Execução inválida.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [liAccounts, ghRepos] = await Promise.all([
          api.linkedinAccounts(),
          api.githubRepositories(),
        ]);

        let detail = canUsePrefetched ? prefetchedJob : null;

        if (!detail && normalizedKind === "linkedin") {
          try {
            detail = await api.linkedinJob(numericId);
          } catch {
            const list = await api.linkedinJobs(1000);
            detail = (list ?? []).find((item) => Number(item.id) === numericId) ?? null;
          }
        } else if (!detail) {
          try {
            detail = await api.leetcodeJob(numericId);
          } catch {
            const list = await api.leetcodeJobs({ limit: 1000 });
            detail = (list ?? []).find((item) => Number(item.id) === numericId) ?? null;
          }
        }

        if (!detail) throw new Error("Execução não encontrada.");

        let logsData = null;
        if (normalizedKind === "leetcode") {
          try {
            logsData = await api.leetcodeJobLogs(numericId);
          } catch {
            logsData = null;
          }
        }

        if (!cancelled) {
          setAccounts(liAccounts ?? []);
          setRepositories(ghRepos ?? []);
          setJob(detail);
          setLogs(logsData);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          if (canUsePrefetched) {
            setJob(prefetchedJob);
            setError("");
          } else {
            setError(getErrorMessage(err, "Falha ao carregar detalhamento da execução."));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [normalizedKind, numericId, canUsePrefetched, prefetchedJob]);

  const accountNameById = useMemo(() => new Map(accounts.map((item) => [item.id, item.name])), [accounts]);
  const repoNameById = useMemo(() => new Map(repositories.map((item) => [item.id, item.repo_ssh_url])), [repositories]);

  const destination = useMemo(() => {
    if (!job) return "-";
    if (normalizedKind === "linkedin") return accountNameById.get(job.account_id) ?? `Conta #${job.account_id ?? "-"}`;
    return repoNameById.get(job.repository_id) ?? `Repositório #${job.repository_id ?? "-"}`;
  }, [job, normalizedKind, accountNameById, repoNameById]);

  if (loading) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  return (
    <div className="space-y-5">
      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Execução</p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Detalhamento</h2>
          </div>
          <Link to="/resultados" className={`rounded-lg px-3 py-2 text-sm font-semibold ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
            Voltar
          </Link>
        </div>
      </section>

      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

      {job ? (
        <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="grid gap-3 md:grid-cols-2">
            <Info label="ID" value={`#${job.id ?? "-"}`} isDarkMode={isDarkMode} />
            <Info label="Tipo" value={normalizedKind} isDarkMode={isDarkMode} />
            <Info label="Status" value={job.status ?? "-"} isDarkMode={isDarkMode} />
            <Info label="Destino" value={destination} isDarkMode={isDarkMode} />
            <Info label="Tentativas" value={`${job.attempts ?? 0}/${job.max_attempts ?? "-"}`} isDarkMode={isDarkMode} />
            <Info label="Atualizado em" value={formatDate(job.updated_at)} isDarkMode={isDarkMode} />
          </div>

          <div className="mt-4 space-y-3">
            {normalizedKind === "linkedin" ? (
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
          </div>
        </section>
      ) : null}

      {normalizedKind === "leetcode" && logs ? (
        <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <h3 className={`mb-2 text-base font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Logs</h3>
          <pre className={`max-h-[420px] overflow-auto rounded-xl border p-3 text-xs ${isDarkMode ? "border-slate-700 bg-slate-950 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-800"}`}>
            {formatLogs(logs)}
          </pre>
        </section>
      ) : null}
    </div>
  );
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
