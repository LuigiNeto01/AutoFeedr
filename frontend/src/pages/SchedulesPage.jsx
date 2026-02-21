import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const LI_CREATE = {
  account_id: "",
  topic: "",
  cron_expr: "",
  day_of_week: "",
  time_local: "",
  timezone: "America/Sao_Paulo",
  is_active: true,
};
const LC_CREATE = {
  repository_id: "",
  cron_expr: "",
  day_of_week: "",
  time_local: "",
  timezone: "America/Sao_Paulo",
  selection_strategy: "random",
  difficulty_policy: "free_any",
  max_attempts: 5,
  is_active: true,
};

export default function SchedulesPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingLi, setSavingLi] = useState(false);
  const [savingLc, setSavingLc] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState("linkedin");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [linkedinSchedules, setLinkedinSchedules] = useState([]);
  const [leetcodeSchedules, setLeetcodeSchedules] = useState([]);
  const [liForm, setLiForm] = useState(LI_CREATE);
  const [lcForm, setLcForm] = useState(LC_CREATE);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [liAccounts, ghRepos, liSchedules, lcSchedules] = await Promise.all([
        api.linkedinAccounts(),
        api.githubRepositories(),
        api.linkedinSchedules(),
        api.leetcodeSchedules(),
      ]);
      setAccounts(liAccounts ?? []);
      setRepositories(ghRepos ?? []);
      setLinkedinSchedules(liSchedules ?? []);
      setLeetcodeSchedules(lcSchedules ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar agendamentos."));
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
    const liRows = linkedinSchedules.map((item) => ({
      id: item.id,
      uid: `li-${item.id}`,
      kind: "linkedin_post",
      destination: accountById.get(item.account_id) ?? `Conta #${item.account_id}`,
      frequency: item.cron_expr,
      timezone: item.timezone,
      retries: "-",
      isActive: item.is_active,
      updatedAt: item.updated_at,
    }));
    const lcRows = leetcodeSchedules.map((item) => ({
      id: item.id,
      uid: `lc-${item.id}`,
      kind: "leetcode_commit",
      destination: repoById.get(item.repository_id) ?? `Repo #${item.repository_id}`,
      frequency: item.cron_expr,
      timezone: item.timezone,
      retries: String(item.max_attempts || "-"),
      isActive: item.is_active,
      updatedAt: item.updated_at,
    }));
    return [...liRows, ...lcRows].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [accounts, repositories, linkedinSchedules, leetcodeSchedules]);

  const createLinkedin = async (event) => {
    event.preventDefault();
    if (savingLi) return;
    setSavingLi(true);
    setError("");
    setSuccess("");
    try {
      await api.createLinkedinSchedule({
        account_id: Number(liForm.account_id),
        topic: liForm.topic.trim(),
        cron_expr: liForm.cron_expr.trim() || undefined,
        day_of_week: liForm.day_of_week === "" ? undefined : Number(liForm.day_of_week),
        time_local: liForm.time_local.trim() || undefined,
        timezone: liForm.timezone.trim(),
        is_active: liForm.is_active,
      });
      setLiForm(LI_CREATE);
      setSuccess("Agendamento LinkedIn criado.");
      setIsCreateModalOpen(false);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar agendamento LinkedIn."));
    } finally {
      setSavingLi(false);
    }
  };

  const createLeetcode = async (event) => {
    event.preventDefault();
    if (savingLc) return;
    setSavingLc(true);
    setError("");
    setSuccess("");
    try {
      await api.createLeetcodeSchedule({
        repository_id: Number(lcForm.repository_id),
        cron_expr: lcForm.cron_expr.trim() || undefined,
        day_of_week: lcForm.day_of_week === "" ? undefined : Number(lcForm.day_of_week),
        time_local: lcForm.time_local.trim() || undefined,
        timezone: lcForm.timezone.trim(),
        selection_strategy: lcForm.selection_strategy,
        difficulty_policy: lcForm.difficulty_policy,
        max_attempts: Number(lcForm.max_attempts) || 1,
        is_active: lcForm.is_active,
      });
      setLcForm(LC_CREATE);
      setSuccess("Agendamento LeetCode criado.");
      setIsCreateModalOpen(false);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar agendamento LeetCode."));
    } finally {
      setSavingLc(false);
    }
  };

  const toggleActive = async (row, checked) => {
    if (busyId) return;
    setBusyId(row.uid);
    try {
      if (row.kind === "linkedin_post") await api.updateLinkedinSchedule(row.id, { is_active: checked });
      else await api.updateLeetcodeSchedule(row.id, { is_active: checked });
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar status do agendamento."));
    } finally {
      setBusyId("");
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

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Execucao</p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Agendamentos</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsCreateModalOpen(true)} className={`rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>Novo agendamento</button>
            <button type="button" onClick={() => loadData({ silent: true })} className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Schedules ativos</h3>
        {rows.length === 0 ? (
          <Empty isDarkMode={isDarkMode} text="Nenhum schedule encontrado." />
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <article key={row.uid} className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{row.kind} #{row.id}</p>
                    <p className={`text-sm break-all ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{row.destination}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge active={row.isActive} isDarkMode={isDarkMode} />
                    <label className={`inline-flex items-center gap-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                      <input type="checkbox" checked={row.isActive} disabled={busyId === row.uid} onChange={(e) => toggleActive(row, e.target.checked)} />
                      Ativo
                    </label>
                  </div>
                </div>
                <div className={`mt-2 grid gap-1 text-xs md:grid-cols-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  <p>Frequencia: {row.frequency || "-"}</p>
                  <p>Timezone: {row.timezone || "-"}</p>
                  <p>Retries: {row.retries}</p>
                  <p>Atualizado: {formatDate(row.updatedAt)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isCreateModalOpen ? (
        <CreateScheduleModal
          isDarkMode={isDarkMode}
          tab={tab}
          setTab={setTab}
          accounts={accounts}
          repositories={repositories}
          liForm={liForm}
          setLiForm={setLiForm}
          lcForm={lcForm}
          setLcForm={setLcForm}
          createLinkedin={createLinkedin}
          createLeetcode={createLeetcode}
          savingLi={savingLi}
          savingLc={savingLc}
          onClose={() => setIsCreateModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function CreateScheduleModal({
  isDarkMode,
  tab,
  setTab,
  accounts,
  repositories,
  liForm,
  setLiForm,
  lcForm,
  setLcForm,
  createLinkedin,
  createLeetcode,
  savingLi,
  savingLc,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55" aria-label="Fechar modal" />
      <div className={`relative z-10 w-full max-w-2xl rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Novo agendamento</h3>
        <div className={`mb-3 inline-flex rounded-xl border p-1 ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
          <Chip active={tab === "linkedin"} onClick={() => setTab("linkedin")} isDarkMode={isDarkMode}>LinkedIn</Chip>
          <Chip active={tab === "leetcode"} onClick={() => setTab("leetcode")} isDarkMode={isDarkMode}>LeetCode</Chip>
        </div>

        {tab === "linkedin" ? (
          <form className="space-y-3" onSubmit={createLinkedin}>
            <SelectField label="Conta" value={liForm.account_id} onChange={(value) => setLiForm((prev) => ({ ...prev, account_id: value }))} isDarkMode={isDarkMode} options={accounts.map((item) => ({ value: String(item.id), label: item.name }))} />
            <InputField label="Topico" value={liForm.topic} onChange={(value) => setLiForm((prev) => ({ ...prev, topic: value }))} isDarkMode={isDarkMode} />
            <InputField label="Cron expression" value={liForm.cron_expr} onChange={(value) => setLiForm((prev) => ({ ...prev, cron_expr: value }))} isDarkMode={isDarkMode} />
            <div className="grid gap-3 grid-cols-2">
              <SelectField label="Dia da semana" value={liForm.day_of_week} onChange={(value) => setLiForm((prev) => ({ ...prev, day_of_week: value }))} isDarkMode={isDarkMode} options={WEEK_DAYS} />
              <InputField label="Hora local" value={liForm.time_local} onChange={(value) => setLiForm((prev) => ({ ...prev, time_local: value }))} isDarkMode={isDarkMode} />
            </div>
            <InputField label="Timezone" value={liForm.timezone} onChange={(value) => setLiForm((prev) => ({ ...prev, timezone: value }))} isDarkMode={isDarkMode} />
            <CheckField label="Ativo" checked={liForm.is_active} onChange={(checked) => setLiForm((prev) => ({ ...prev, is_active: checked }))} isDarkMode={isDarkMode} />
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={savingLi} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{savingLi ? "Criando..." : "Criar schedule LinkedIn"}</button>
              <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={createLeetcode}>
            <SelectField label="Repositorio" value={lcForm.repository_id} onChange={(value) => setLcForm((prev) => ({ ...prev, repository_id: value }))} isDarkMode={isDarkMode} options={repositories.map((item) => ({ value: String(item.id), label: item.repo_ssh_url }))} />
            <InputField label="Cron expression" value={lcForm.cron_expr} onChange={(value) => setLcForm((prev) => ({ ...prev, cron_expr: value }))} isDarkMode={isDarkMode} />
            <div className="grid gap-3 grid-cols-2">
              <SelectField label="Dia da semana" value={lcForm.day_of_week} onChange={(value) => setLcForm((prev) => ({ ...prev, day_of_week: value }))} isDarkMode={isDarkMode} options={WEEK_DAYS} />
              <InputField label="Hora local" value={lcForm.time_local} onChange={(value) => setLcForm((prev) => ({ ...prev, time_local: value }))} isDarkMode={isDarkMode} />
            </div>
            <InputField label="Timezone" value={lcForm.timezone} onChange={(value) => setLcForm((prev) => ({ ...prev, timezone: value }))} isDarkMode={isDarkMode} />
            <div className="grid gap-3 grid-cols-2">
              <SelectField label="Selection strategy" value={lcForm.selection_strategy} onChange={(value) => setLcForm((prev) => ({ ...prev, selection_strategy: value }))} isDarkMode={isDarkMode} options={[{ value: "random", label: "random" }, { value: "easy_first", label: "easy_first" }, { value: "sequential", label: "sequential" }]} />
              <SelectField label="Difficulty policy" value={lcForm.difficulty_policy} onChange={(value) => setLcForm((prev) => ({ ...prev, difficulty_policy: value }))} isDarkMode={isDarkMode} options={[{ value: "free_any", label: "free_any" }, { value: "free_easy", label: "free_easy" }, { value: "free_easy_medium", label: "free_easy_medium" }]} />
            </div>
            <InputField type="number" label="Max attempts" value={String(lcForm.max_attempts)} onChange={(value) => setLcForm((prev) => ({ ...prev, max_attempts: Number(value) || 1 }))} isDarkMode={isDarkMode} />
            <CheckField label="Ativo" checked={lcForm.is_active} onChange={(checked) => setLcForm((prev) => ({ ...prev, is_active: checked }))} isDarkMode={isDarkMode} />
            <div className="grid grid-cols-2 gap-2">
              <button type="submit" disabled={savingLc} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{savingLc ? "Criando..." : "Criar schedule LeetCode"}</button>
              <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const WEEK_DAYS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terca" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sabado" },
];

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

function Empty({ text, isDarkMode }) {
  return <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>{text}</div>;
}

function Chip({ active, onClick, isDarkMode, children }) {
  return <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? (isDarkMode ? "bg-slate-600 text-slate-100" : "bg-white text-slate-900 shadow-sm") : (isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100")}`}>{children}</button>;
}

function InputField({ label, value, onChange, isDarkMode, type = "text" }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} /></label>;
}

function SelectField({ label, value, onChange, options, isDarkMode }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}><option value="">Selecionar...</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function CheckField({ label, checked, onChange, isDarkMode }) {
  return <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function StatusBadge({ active, isDarkMode }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${active ? (isDarkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>{active ? "Ativo" : "Inativo"}</span>;
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
