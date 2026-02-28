import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const ACCOUNT_CREATE = { name: "", ssh_private_key: "", ssh_passphrase: "", is_active: true };
const ACCOUNT_EDIT = { ssh_private_key: "", ssh_passphrase: "", is_active: true };
const REPO_CREATE = {
  account_id: "",
  repo_ssh_url: "",
  default_branch: "main",
  solutions_dir: "problems",
  commit_author_name: "",
  commit_author_email: "",
  selection_strategy: "random",
  difficulty_policy: "free_any",
  is_active: true,
};
const REPO_EDIT = {
  account_id: "",
  default_branch: "main",
  solutions_dir: "problems",
  commit_author_name: "",
  commit_author_email: "",
  selection_strategy: "random",
  difficulty_policy: "free_any",
  is_active: true,
};

const STRATEGIES = ["random", "easy_first", "sequential"];
const DIFFICULTIES = ["free_any", "free_easy", "free_easy_medium"];

export default function GithubAccountsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;

  const [accounts, setAccounts] = useState([]);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [savingAccount, setSavingAccount] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState(null);
  const [busyRepoId, setBusyRepoId] = useState(null);

  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [createRepoOpen, setCreateRepoOpen] = useState(false);
  const [editRepoOpen, setEditRepoOpen] = useState(false);

  const [editingAccount, setEditingAccount] = useState(null);
  const [editingRepo, setEditingRepo] = useState(null);

  const [accountCreateForm, setAccountCreateForm] = useState(ACCOUNT_CREATE);
  const [accountEditForm, setAccountEditForm] = useState(ACCOUNT_EDIT);
  const [repoCreateForm, setRepoCreateForm] = useState(REPO_CREATE);
  const [repoEditForm, setRepoEditForm] = useState(REPO_EDIT);
  const [mobileTab, setMobileTab] = useState("repositories");

  async function loadData({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [acc, rep] = await Promise.all([api.githubAccounts(), api.githubRepositories()]);
      setAccounts(acc ?? []);
      setRepositories(rep ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar dados de GitHub."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const filteredRepos = useMemo(() => {
    const text = search.trim().toLowerCase();
    return repositories.filter((repo) => {
      const bySearch =
        !text ||
        repo.repo_ssh_url?.toLowerCase().includes(text) ||
        repo.commit_author_name?.toLowerCase().includes(text) ||
        accountMap.get(repo.account_id)?.toLowerCase().includes(text);
      const byFilter = filter === "all" || (filter === "active" ? repo.is_active : !repo.is_active);
      return bySearch && byFilter;
    });
  }, [repositories, search, filter, accountMap]);

  const stats = useMemo(() => {
    const activeAccounts = accounts.filter((a) => a.is_active).length;
    const activeRepos = repositories.filter((r) => r.is_active).length;
    return { aTotal: accounts.length, aActive: activeAccounts, rTotal: repositories.length, rActive: activeRepos };
  }, [accounts, repositories]);

  const openAccountEdit = (account) => {
    setEditingAccount(account);
    setAccountEditForm({ ssh_private_key: "", ssh_passphrase: "", is_active: account.is_active });
    setEditAccountOpen(true);
  };

  const openRepoEdit = (repo) => {
    setEditingRepo(repo);
    setRepoEditForm({
      account_id: String(repo.account_id ?? ""),
      default_branch: repo.default_branch ?? "main",
      solutions_dir: repo.solutions_dir ?? "problems",
      commit_author_name: repo.commit_author_name ?? "",
      commit_author_email: repo.commit_author_email ?? "",
      selection_strategy: repo.selection_strategy ?? "random",
      difficulty_policy: repo.difficulty_policy ?? "free_any",
      is_active: repo.is_active,
    });
    setEditRepoOpen(true);
  };

  const createAccount = async (e) => {
    e.preventDefault();
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      if (!accountCreateForm.name.trim() || !accountCreateForm.ssh_private_key.trim()) {
        throw new Error("Informe nome e SSH private key.");
      }
      await api.createGithubAccount({
        name: accountCreateForm.name.trim(),
        ssh_private_key: accountCreateForm.ssh_private_key.trim(),
        ssh_passphrase: accountCreateForm.ssh_passphrase.trim() || null,
        is_active: accountCreateForm.is_active,
      });
      setCreateAccountOpen(false);
      setAccountCreateForm(ACCOUNT_CREATE);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar conta GitHub."));
    } finally {
      setSavingAccount(false);
    }
  };

  const updateAccount = async (e) => {
    e.preventDefault();
    if (savingAccount || !editingAccount) return;
    setSavingAccount(true);
    try {
      const payload = { is_active: accountEditForm.is_active };
      const key = accountEditForm.ssh_private_key.trim();
      const pass = accountEditForm.ssh_passphrase.trim();
      if (key) payload.ssh_private_key = key;
      if (pass) payload.ssh_passphrase = pass;
      await api.updateGithubAccount(editingAccount.id, payload);
      setEditAccountOpen(false);
      setEditingAccount(null);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar conta GitHub."));
    } finally {
      setSavingAccount(false);
    }
  };

  const removeAccount = async (account) => {
    if (busyAccountId) return;
    if (!window.confirm(`Excluir conta "${account.name}"?`)) return;
    setBusyAccountId(account.id);
    try {
      await api.deleteGithubAccount(account.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao excluir conta."));
    } finally {
      setBusyAccountId(null);
    }
  };

  const toggleAccount = async (account, checked) => {
    if (busyAccountId) return;
    setBusyAccountId(account.id);
    try {
      await api.updateGithubAccount(account.id, { is_active: checked });
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao alterar status da conta."));
    } finally {
      setBusyAccountId(null);
    }
  };

  const createRepo = async (e) => {
    e.preventDefault();
    if (savingRepo) return;
    setSavingRepo(true);
    try {
      if (!repoCreateForm.account_id) throw new Error("Selecione uma conta GitHub.");
      if (!repoCreateForm.repo_ssh_url.trim()) throw new Error("Informe o repo SSH URL.");
      await api.createGithubRepository({
        account_id: Number(repoCreateForm.account_id),
        repo_ssh_url: repoCreateForm.repo_ssh_url.trim(),
        default_branch: repoCreateForm.default_branch.trim(),
        solutions_dir: repoCreateForm.solutions_dir.trim(),
        commit_author_name: repoCreateForm.commit_author_name.trim(),
        commit_author_email: repoCreateForm.commit_author_email.trim(),
        selection_strategy: repoCreateForm.selection_strategy,
        difficulty_policy: repoCreateForm.difficulty_policy,
        is_active: repoCreateForm.is_active,
      });
      setCreateRepoOpen(false);
      setRepoCreateForm(REPO_CREATE);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar repositório."));
    } finally {
      setSavingRepo(false);
    }
  };

  const updateRepo = async (e) => {
    e.preventDefault();
    if (savingRepo || !editingRepo) return;
    setSavingRepo(true);
    try {
      if (!repoEditForm.account_id) throw new Error("Selecione uma conta GitHub.");
      await api.updateGithubRepository(editingRepo.id, {
        account_id: Number(repoEditForm.account_id),
        default_branch: repoEditForm.default_branch.trim(),
        solutions_dir: repoEditForm.solutions_dir.trim(),
        commit_author_name: repoEditForm.commit_author_name.trim(),
        commit_author_email: repoEditForm.commit_author_email.trim(),
        selection_strategy: repoEditForm.selection_strategy,
        difficulty_policy: repoEditForm.difficulty_policy,
        is_active: repoEditForm.is_active,
      });
      setEditRepoOpen(false);
      setEditingRepo(null);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar repositório."));
    } finally {
      setSavingRepo(false);
    }
  };

  const removeRepo = async (repo) => {
    if (busyRepoId) return;
    if (!window.confirm(`Excluir repositório "${repo.repo_ssh_url}"?`)) return;
    setBusyRepoId(repo.id);
    try {
      await api.deleteGithubRepository(repo.id);
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao excluir repositório."));
    } finally {
      setBusyRepoId(null);
    }
  };

  const toggleRepo = async (repo, checked) => {
    if (busyRepoId) return;
    setBusyRepoId(repo.id);
    try {
      await api.updateGithubRepository(repo.id, { is_active: checked });
      await loadData({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao alterar status do repositório."));
    } finally {
      setBusyRepoId(null);
    }
  };

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  if (loading) return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;

  return (
    <div className="space-y-5">
      {error ? <div className={`rounded-xl border px-4 py-3 text-sm ${isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>{error}</div> : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${sub}`}>Contas</p>
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>GitHub</h2>
            <p className={`mt-1 text-sm ${sub}`}>Mesma ideia do LinkedIn, agora para contas SSH e repositórios.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadData({ silent: true })} className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}>{refreshing ? "Atualizando..." : "Atualizar"}</button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contas" value={stats.aTotal} isDarkMode={isDarkMode} />
        <Stat label="Contas ativas" value={stats.aActive} isDarkMode={isDarkMode} />
        <Stat label="Repositórios" value={stats.rTotal} isDarkMode={isDarkMode} />
        <Stat label="Repos ativos" value={stats.rActive} isDarkMode={isDarkMode} />
      </section>

      <section className={`mb-1 inline-flex w-full rounded-xl border p-1 md:hidden ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
        <Chip active={mobileTab === "accounts"} onClick={() => setMobileTab("accounts")} isDarkMode={isDarkMode}>Contas</Chip>
        <Chip active={mobileTab === "repositories"} onClick={() => setMobileTab("repositories")} isDarkMode={isDarkMode}>Repos</Chip>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <div className={`rounded-2xl border p-4 shadow-sm lg:col-span-4 ${panel} ${mobileTab === "accounts" ? "block" : "hidden md:block"}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-lg font-semibold ${txt}`}>Contas SSH</h3>
            <button type="button" onClick={() => setCreateAccountOpen(true)} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>Nova conta</button>
          </div>
          {accounts.length === 0 ? <Empty text="Nenhuma conta GitHub cadastrada." isDarkMode={isDarkMode} /> : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <article key={a.id} className={`rounded-xl border p-3 ${card}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className={`truncate text-sm font-semibold ${txt}`}>{a.name}</h4>
                    <StatusBadge active={a.is_active} isDarkMode={isDarkMode} />
                  </div>
                  <p className={`mb-3 text-xs ${sub}`}>Atualizada em {formatDate(a.updated_at)}</p>
                  <div className="flex items-center justify-between gap-2">
                    <label className={`inline-flex items-center gap-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={a.is_active} disabled={busyAccountId === a.id} onChange={(e) => toggleAccount(a, e.target.checked)} />Ativa</label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openAccountEdit(a)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}>Editar</button>
                      <button type="button" disabled={busyAccountId === a.id} onClick={() => removeAccount(a)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition ${isDarkMode ? "bg-red-700/80 hover:bg-red-700" : "bg-red-600 hover:bg-red-500"}`}>Excluir</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm lg:col-span-8 ${mobileTab === "repositories" ? "block" : "hidden md:block"} ${panel}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className={`text-lg font-semibold ${txt}`}>Repositórios</h3>
            <button type="button" onClick={() => setCreateRepoOpen(true)} disabled={!accounts.length} className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${isDarkMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-700 hover:bg-emerald-600"}`}>Novo repositório</button>
          </div>
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar repositório, autor ou conta..." className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`} />
            <div className={`inline-flex w-full rounded-xl border p-1 md:w-auto ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
              <Chip active={filter === "all"} onClick={() => setFilter("all")} isDarkMode={isDarkMode}>Todos</Chip>
              <Chip active={filter === "active"} onClick={() => setFilter("active")} isDarkMode={isDarkMode}>Ativos</Chip>
              <Chip active={filter === "inactive"} onClick={() => setFilter("inactive")} isDarkMode={isDarkMode}>Inativos</Chip>
            </div>
          </div>

          {filteredRepos.length === 0 ? <Empty text="Nenhum repositório encontrado para os filtros atuais." isDarkMode={isDarkMode} /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredRepos.map((r) => (
                <article key={r.id} className={`rounded-2xl border p-4 transition ${card}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`truncate text-sm font-semibold ${txt}`}>{extractRepoName(r.repo_ssh_url)}</h3>
                      <p className={`mt-0.5 break-all text-[11px] ${sub}`}>{r.repo_ssh_url}</p>
                      <p className={`mt-0.5 truncate text-xs ${sub}`}>Conta: {accountMap.get(r.account_id) ?? `#${r.account_id}`}</p>
                    </div>
                    <StatusBadge active={r.is_active} isDarkMode={isDarkMode} />
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
                    <span className={`rounded-full px-2 py-1 ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>Branch: {r.default_branch}</span>
                    <span className={`rounded-full px-2 py-1 ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>Dir: {r.solutions_dir}</span>
                    <span className={`rounded-full px-2 py-1 ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>Estratégia: {r.selection_strategy}</span>
                    <span className={`rounded-full px-2 py-1 ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>Dificuldade: {r.difficulty_policy}</span>
                  </div>
                  <p className={`mb-3 text-xs ${sub}`}>Autor: {r.commit_author_name} ({r.commit_author_email})</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={`text-xs ${sub}`}>Atualizado em {formatDate(r.updated_at)}</p>
                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                      <label className={`inline-flex items-center gap-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={r.is_active} disabled={busyRepoId === r.id} onChange={(e) => toggleRepo(r, e.target.checked)} />Ativo</label>
                      <button type="button" onClick={() => openRepoEdit(r)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}>Editar</button>
                      <button type="button" disabled={busyRepoId === r.id} onClick={() => removeRepo(r)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition ${isDarkMode ? "bg-red-700/80 hover:bg-red-700" : "bg-red-600 hover:bg-red-500"}`}>Excluir</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {createAccountOpen ? <AccountModal isDarkMode={isDarkMode} title="Nova conta GitHub" submit={savingAccount ? "Criando..." : "Criar conta"} form={accountCreateForm} setForm={setAccountCreateForm} onSubmit={createAccount} onClose={() => setCreateAccountOpen(false)} saving={savingAccount} showName requireKey /> : null}
      {editAccountOpen ? <AccountModal isDarkMode={isDarkMode} title={`Editar: ${editingAccount?.name ?? "conta"}`} submit={savingAccount ? "Salvando..." : "Salvar alterações"} form={accountEditForm} setForm={setAccountEditForm} onSubmit={updateAccount} onClose={() => { setEditAccountOpen(false); setEditingAccount(null); }} saving={savingAccount} /> : null}
      {createRepoOpen ? <RepoModal isDarkMode={isDarkMode} title="Novo repositório" submit={savingRepo ? "Criando..." : "Criar repositório"} form={repoCreateForm} setForm={setRepoCreateForm} onSubmit={createRepo} onClose={() => setCreateRepoOpen(false)} saving={savingRepo} accounts={accounts} showRepoUrl /> : null}
      {editRepoOpen ? <RepoModal isDarkMode={isDarkMode} title={`Editar: ${editingRepo?.repo_ssh_url ?? "repositório"}`} submit={savingRepo ? "Salvando..." : "Salvar alterações"} form={repoEditForm} setForm={setRepoEditForm} onSubmit={updateRepo} onClose={() => { setEditRepoOpen(false); setEditingRepo(null); }} saving={savingRepo} accounts={accounts} /> : null}
    </div>
  );
}

function AccountModal({ title, submit, form, setForm, onSubmit, onClose, isDarkMode, saving, showName = false, requireKey = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55" aria-label="Fechar modal" />
      <div className={`popup-surface ${isDarkMode ? "popup-surface-dark" : "popup-surface-light"} relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 shadow-xl`}>
        <h3 className={`mb-4 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
        <form className="space-y-3" onSubmit={onSubmit}>
          {showName ? <Field label="Nome" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))} isDarkMode={isDarkMode} /> : null}
          <Area label={requireKey ? "SSH private key" : "Nova SSH private key (opcional)"} value={form.ssh_private_key} rows={6} onChange={(v) => setForm((p) => ({ ...p, ssh_private_key: v }))} isDarkMode={isDarkMode} />
          <Field label="Passphrase (opcional)" type="password" value={form.ssh_passphrase} onChange={(v) => setForm((p) => ({ ...p, ssh_passphrase: v }))} isDarkMode={isDarkMode} />
          <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />Conta ativa</label>
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <button type="submit" disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}>{submit}</button>
            <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RepoModal({ title, submit, form, setForm, onSubmit, onClose, isDarkMode, saving, accounts, showRepoUrl = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/55" aria-label="Fechar modal" />
      <div className={`popup-surface ${isDarkMode ? "popup-surface-dark" : "popup-surface-light"} relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-4 shadow-xl`}>
        <h3 className={`mb-4 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
        <form className="space-y-3" onSubmit={onSubmit}>
          <Select label="Conta" value={form.account_id} onChange={(v) => setForm((p) => ({ ...p, account_id: v }))} options={accounts.map((a) => ({ value: String(a.id), label: a.name }))} isDarkMode={isDarkMode} />
          {showRepoUrl ? <Field label="Repo SSH URL" value={form.repo_ssh_url} onChange={(v) => setForm((p) => ({ ...p, repo_ssh_url: v }))} isDarkMode={isDarkMode} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Branch padrão" value={form.default_branch} onChange={(v) => setForm((p) => ({ ...p, default_branch: v }))} isDarkMode={isDarkMode} />
            <Field label="Diretório de soluções" value={form.solutions_dir} onChange={(v) => setForm((p) => ({ ...p, solutions_dir: v }))} isDarkMode={isDarkMode} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Autor" value={form.commit_author_name} onChange={(v) => setForm((p) => ({ ...p, commit_author_name: v }))} isDarkMode={isDarkMode} />
            <Field label="Email autor" value={form.commit_author_email} onChange={(v) => setForm((p) => ({ ...p, commit_author_email: v }))} isDarkMode={isDarkMode} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Estratégia" value={form.selection_strategy} onChange={(v) => setForm((p) => ({ ...p, selection_strategy: v }))} options={STRATEGIES.map((s) => ({ value: s, label: s }))} isDarkMode={isDarkMode} />
            <Select label="Política de dificuldade" value={form.difficulty_policy} onChange={(v) => setForm((p) => ({ ...p, difficulty_policy: v }))} options={DIFFICULTIES.map((d) => ({ value: d, label: d }))} isDarkMode={isDarkMode} />
          </div>
          <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />Repositório ativo</label>
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <button type="submit" disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-emerald-600 hover:bg-emerald-500" : "bg-emerald-700 hover:bg-emerald-600"}`}>{submit}</button>
            <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, isDarkMode }) {
  return <div className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}><p className={`text-xs uppercase tracking-[0.18em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p><p className={`mt-2 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p></div>;
}

function Chip({ active, onClick, isDarkMode, children }) {
  return <button type="button" onClick={onClick} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition md:flex-none ${active ? (isDarkMode ? "bg-slate-600 text-slate-100" : "bg-white text-slate-900 shadow-sm") : (isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-600 hover:bg-slate-100")}`}>{children}</button>;
}

function Field({ label, value, onChange, isDarkMode, type = "text" }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} /></label>;
}

function Area({ label, value, onChange, isDarkMode, rows = 3 }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`} /></label>;
}

function Select({ label, value, onChange, options, isDarkMode }) {
  return <label className="block"><span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}><option value="">Selecionar...</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function Empty({ text, isDarkMode }) {
  return <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>{text}</div>;
}

function StatusBadge({ active, isDarkMode }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${active ? (isDarkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>{active ? "Ativo" : "Inativo"}</span>;
}

function extractRepoName(repoSshUrl) {
  const raw = String(repoSshUrl || "").trim();
  const match = raw.match(/^[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
  if (match) return match[2];
  const slash = raw.lastIndexOf("/");
  const name = slash >= 0 ? raw.slice(slash + 1) : raw;
  return name.replace(/\.git$/, "") || raw;
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "-";
  }
}

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError) {
    if (typeof err.detail === "string") return err.detail || fallback;
    if (Array.isArray(err.detail)) {
      const first = err.detail[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object") return `${(first.loc || []).at(-1) ?? "campo"}: ${first.msg || "valor inválido"}`;
    }
  }
  return err?.message || fallback;
}
