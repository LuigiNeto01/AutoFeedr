import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const INITIAL_FORM = {
  flow: "linkedin_post",
  account_id: "",
  topic: "",
  paper_url: "",
  paper_text: "",
  repository_id: "",
  selection_strategy: "random",
  difficulty_policy: "free_any",
  problem_slug: "",
  max_attempts: 5,
};

export default function RunNowPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [liAccounts, ghRepos] = await Promise.all([
          api.linkedinAccounts(),
          api.githubRepositories(),
        ]);
        setAccounts(liAccounts ?? []);
        setRepositories(ghRepos ?? []);
      } catch (err) {
        setError(getErrorMessage(err, "Falha ao carregar contas e repositorios."));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const isLinkedin = form.flow === "linkedin_post";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let job;
      if (isLinkedin) {
        if (!form.account_id) throw new Error("Selecione uma conta LinkedIn.");
        if (!form.topic.trim() && !form.paper_url.trim() && !form.paper_text.trim()) {
          throw new Error("Informe topico, paper URL ou paper text.");
        }
        job = await api.runLinkedinNow({
          account_id: Number(form.account_id),
          topic: form.topic.trim() || undefined,
          paper_url: form.paper_url.trim() || undefined,
          paper_text: form.paper_text.trim() || undefined,
        });
      } else {
        if (!form.repository_id) throw new Error("Selecione um repositorio GitHub.");
        job = await api.runLeetcodeNow({
          repository_id: Number(form.repository_id),
          selection_strategy: form.selection_strategy || undefined,
          difficulty_policy: form.difficulty_policy || undefined,
          problem_slug: form.problem_slug.trim() || undefined,
          max_attempts: Number(form.max_attempts) || undefined,
        });
      }
      setResult({ flow: form.flow, job });
      setSuccess("Execucao enfileirada com sucesso.");
      setIsModalOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao disparar execucao."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`}
      />
    );
  }

  return (
    <div className="space-y-5">
      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}
      {success ? <Message tone="success" text={success} isDarkMode={isDarkMode} /> : null}

      <section
        className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
      >
        <p
          className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
        >
          Execucao
        </p>
        <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
          Executar Agora
        </h2>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section
          className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
        >
          <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
            Disparo manual
          </h3>
          <div className={`space-y-2 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
            <p>1. Clique em executar agora no card ao lado.</p>
            <p>2. Escolha o fluxo no radio (LinkedIn ou LeetCode).</p>
            <p>3. Preencha os campos e confirme.</p>
          </div>
        </section>

        <section
          className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              Retorno imediato
            </h3>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              Executar agora
            </button>
          </div>

          {!result ? (
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Nenhuma execucao disparada nesta sessao.
            </p>
          ) : (
            <div
              className={`space-y-2 rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}
            >
              <p
                className={`text-xs uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
              >
                {result.flow}
              </p>
              <p className={`text-xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                job_id #{result.job?.id ?? "-"}
              </p>
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                Status: {result.job?.status ?? "-"}
              </p>
              <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Tentativas: {result.job?.attempts ?? 0}/{result.job?.max_attempts ?? "-"}
              </p>
            </div>
          )}
        </section>
      </section>

      {isModalOpen ? (
        <RunNowModal
          isDarkMode={isDarkMode}
          form={form}
          setForm={setForm}
          accounts={accounts}
          repositories={repositories}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function RunNowModal({ isDarkMode, form, setForm, accounts, repositories, onClose, onSubmit, saving }) {
  const isLinkedin = form.flow === "linkedin_post";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55" aria-label="Fechar modal" />
      <div className={`relative z-10 w-full max-w-2xl rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-4 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Executar agora</h3>
        <form className="space-y-3" onSubmit={onSubmit}>
          <fieldset className="space-y-2">
            <legend className={`text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>Fluxo</legend>
            <label className={`flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              <input type="radio" name="flow" value="linkedin_post" checked={form.flow === "linkedin_post"} onChange={(e) => setForm((prev) => ({ ...prev, flow: e.target.value }))} />
              LinkedIn
            </label>
            <label className={`flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-200" : "text-slate-700"}`}>
              <input type="radio" name="flow" value="leetcode_commit" checked={form.flow === "leetcode_commit"} onChange={(e) => setForm((prev) => ({ ...prev, flow: e.target.value }))} />
              LeetCode
            </label>
          </fieldset>

          {isLinkedin ? (
            <>
              <SelectField label="Conta LinkedIn" value={String(form.account_id)} onChange={(value) => setForm((prev) => ({ ...prev, account_id: value }))} isDarkMode={isDarkMode} options={accounts.map((item) => ({ value: String(item.id), label: item.name }))} />
              <InputField label="Topico" value={form.topic} onChange={(value) => setForm((prev) => ({ ...prev, topic: value }))} isDarkMode={isDarkMode} />
              <InputField label="Paper URL" value={form.paper_url} onChange={(value) => setForm((prev) => ({ ...prev, paper_url: value }))} isDarkMode={isDarkMode} />
              <TextField label="Paper text" value={form.paper_text} onChange={(value) => setForm((prev) => ({ ...prev, paper_text: value }))} rows={3} isDarkMode={isDarkMode} />
            </>
          ) : (
            <>
              <SelectField label="Repositorio GitHub" value={String(form.repository_id)} onChange={(value) => setForm((prev) => ({ ...prev, repository_id: value }))} isDarkMode={isDarkMode} options={repositories.map((item) => ({ value: String(item.id), label: item.repo_ssh_url }))} />
              <div className="grid gap-3 md:grid-cols-2">
                <SelectField label="Selection strategy" value={form.selection_strategy} onChange={(value) => setForm((prev) => ({ ...prev, selection_strategy: value }))} isDarkMode={isDarkMode} options={[{ value: "random", label: "random" }, { value: "easy_first", label: "easy_first" }, { value: "sequential", label: "sequential" }]} />
                <SelectField label="Difficulty policy" value={form.difficulty_policy} onChange={(value) => setForm((prev) => ({ ...prev, difficulty_policy: value }))} isDarkMode={isDarkMode} options={[{ value: "free_any", label: "free_any" }, { value: "free_easy", label: "free_easy" }, { value: "free_easy_medium", label: "free_easy_medium" }]} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <InputField label="Problem slug (opcional)" value={form.problem_slug} onChange={(value) => setForm((prev) => ({ ...prev, problem_slug: value }))} isDarkMode={isDarkMode} />
                <InputField label="Max attempts" type="number" value={String(form.max_attempts)} onChange={(value) => setForm((prev) => ({ ...prev, max_attempts: Number(value) || 1 }))} isDarkMode={isDarkMode} />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="submit" disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{saving ? "Disparando..." : "Executar"}</button>
            <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
          </div>
        </form>
      </div>
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

function InputField({ label, value, onChange, isDarkMode, type = "text" }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} />
    </label>
  );
}

function TextField({ label, value, onChange, isDarkMode, rows = 3 }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, isDarkMode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}>
        <option value="">Selecionar...</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}
