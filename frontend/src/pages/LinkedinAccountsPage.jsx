import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

const INITIAL_CREATE = {
  name: "",
  urn: "",
  token: "",
  prompt_generation: "",
  prompt_translation: "",
  is_active: true,
};

const INITIAL_EDIT = {
  urn: "",
  token: "",
  prompt_generation: "",
  prompt_translation: "",
  is_active: true,
};

export default function LinkedinAccountsPage() {
  const outletContext = useOutletContext();
  const isDarkMode = outletContext?.isDarkMode ?? false;

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE);
  const [editForm, setEditForm] = useState(INITIAL_EDIT);

  async function loadAccounts({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.linkedinAccounts();
      setAccounts(data ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar contas LinkedIn."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  const filteredAccounts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return accounts.filter((account) => {
      const matchesSearch =
        !text ||
        account.name?.toLowerCase().includes(text) ||
        account.urn?.toLowerCase().includes(text);
      const matchesFilter =
        filter === "all" || (filter === "active" ? account.is_active : !account.is_active);
      return matchesSearch && matchesFilter;
    });
  }, [accounts, filter, search]);

  const stats = useMemo(() => {
    const active = accounts.filter((a) => a.is_active).length;
    return {
      total: accounts.length,
      active,
      inactive: accounts.length - active,
    };
  }, [accounts]);

  const openEdit = (account) => {
    setEditing(account);
    setEditForm({
      urn: account.urn ?? "",
      token: "",
      prompt_generation: account.prompt_generation ?? "",
      prompt_translation: account.prompt_translation ?? "",
      is_active: account.is_active,
    });
    setEditOpen(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await api.createLinkedinAccount({
        ...createForm,
        name: createForm.name.trim(),
        urn: createForm.urn.trim(),
        token: createForm.token.trim(),
        prompt_generation: createForm.prompt_generation.trim(),
        prompt_translation: createForm.prompt_translation.trim(),
      });
      setCreateForm(INITIAL_CREATE);
      setCreateOpen(false);
      await loadAccounts({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao criar conta LinkedIn."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      const payload = {
        urn: editForm.urn.trim(),
        prompt_generation: editForm.prompt_generation.trim(),
        prompt_translation: editForm.prompt_translation.trim(),
        is_active: editForm.is_active,
      };
      if (editForm.token.trim()) payload.token = editForm.token.trim();
      await api.updateLinkedinAccount(editing.id, payload);
      setEditOpen(false);
      setEditing(null);
      await loadAccounts({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao atualizar conta."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account) => {
    if (busyId) return;
    if (!window.confirm(`Excluir conta "${account.name}"?`)) return;
    setBusyId(account.id);
    try {
      await api.deleteLinkedinAccount(account.id);
      await loadAccounts({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao excluir conta."));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (account, checked) => {
    if (busyId) return;
    setBusyId(account.id);
    try {
      await api.updateLinkedinAccount(account.id, { is_active: checked });
      await loadAccounts({ silent: true });
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao alterar status."));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-3">
        <div className={`h-24 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
        <div className={`h-24 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
        <div className={`h-24 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
        <div className={`h-56 animate-pulse rounded-2xl md:col-span-3 ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />
      </section>
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
              Contas
            </p>
            <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              LinkedIn
            </h2>
            <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Gerencie tokens, URNs e prompts por conta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadAccounts({ silent: true })}
              className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            >
              {refreshing ? "Atualizando..." : "Atualizar"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              Nova conta
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={stats.total} isDarkMode={isDarkMode} />
        <StatCard label="Ativas" value={stats.active} isDarkMode={isDarkMode} />
        <StatCard label="Inativas" value={stats.inactive} isDarkMode={isDarkMode} />
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou URN..."
            className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`}
          />
          <div className={`inline-flex w-full rounded-xl border p-1 md:w-auto ${isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-300 bg-slate-50"}`}>
            <FilterButton label="Todas" active={filter === "all"} onClick={() => setFilter("all")} isDarkMode={isDarkMode} />
            <FilterButton label="Ativas" active={filter === "active"} onClick={() => setFilter("active")} isDarkMode={isDarkMode} />
            <FilterButton label="Inativas" active={filter === "inactive"} onClick={() => setFilter("inactive")} isDarkMode={isDarkMode} />
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-300 text-slate-500"}`}>
            Nenhuma conta encontrada para os filtros atuais.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAccounts.map((account) => (
              <article
                key={account.id}
                className={`rounded-2xl border p-4 transition ${isDarkMode ? "border-slate-700 bg-slate-800/60 hover:bg-slate-800" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className={`truncate font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{account.name}</h3>
                    <p className={`mt-0.5 truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} title={account.urn}>
                      URN: {account.urn}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${account.is_active ? (isDarkMode ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700") : (isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600")}`}>
                    {account.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <Tag label={account.prompt_generation ? "Prompt geração custom" : "Prompt geração padrão"} isDarkMode={isDarkMode} />
                  <Tag label={account.prompt_translation ? "Prompt tradução custom" : "Prompt tradução padrão"} isDarkMode={isDarkMode} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
                    Atualizada em {formatDate(account.updated_at)}
                  </p>
                  <div className="flex items-center gap-2">
                    <label className={`inline-flex items-center gap-1 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                      <input
                        type="checkbox"
                        checked={account.is_active}
                        disabled={busyId === account.id}
                        onChange={(event) => handleToggleActive(account, event.target.checked)}
                      />
                      Ativa
                    </label>
                    <button
                      type="button"
                      onClick={() => openEdit(account)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-900 text-white hover:bg-slate-700"}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === account.id}
                      onClick={() => handleDelete(account)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition ${isDarkMode ? "bg-red-700/80 hover:bg-red-700" : "bg-red-600 hover:bg-red-500"}`}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {createOpen ? (
        <AccountModal
          title="Nova conta LinkedIn"
          submitLabel={saving ? "Criando..." : "Criar conta"}
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onClose={() => setCreateOpen(false)}
          isDarkMode={isDarkMode}
          saving={saving}
          showName
        />
      ) : null}

      {editOpen ? (
        <AccountModal
          title={`Editar: ${editing?.name ?? "conta"}`}
          submitLabel={saving ? "Salvando..." : "Salvar alterações"}
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleEdit}
          onClose={() => {
            setEditOpen(false);
            setEditing(null);
          }}
          isDarkMode={isDarkMode}
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function AccountModal({
  title,
  submitLabel,
  form,
  onChange,
  onSubmit,
  onClose,
  isDarkMode,
  saving,
  showName = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
        aria-label="Fechar modal"
      />
      <div className={`popup-surface ${isDarkMode ? "popup-surface-dark" : "popup-surface-light"} relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 shadow-xl`}>
        <h3 className={`mb-4 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
        <form className="space-y-3" onSubmit={onSubmit}>
          {showName ? (
            <InputField
              label="Nome"
              value={form.name}
              onChange={(value) => onChange((prev) => ({ ...prev, name: value }))}
              isDarkMode={isDarkMode}
            />
          ) : null}
          <InputField
            label="URN"
            value={form.urn}
            onChange={(value) => onChange((prev) => ({ ...prev, urn: value }))}
            isDarkMode={isDarkMode}
          />
          <TextField
            label={showName ? "Token" : "Novo token (opcional)"}
            value={form.token}
            rows={3}
            onChange={(value) => onChange((prev) => ({ ...prev, token: value }))}
            isDarkMode={isDarkMode}
          />
          <TextField
            label="Prompt geração (opcional)"
            value={form.prompt_generation}
            rows={2}
            onChange={(value) => onChange((prev) => ({ ...prev, prompt_generation: value }))}
            isDarkMode={isDarkMode}
          />
          <TextField
            label="Prompt tradução (opcional)"
            value={form.prompt_translation}
            rows={2}
            onChange={(value) => onChange((prev) => ({ ...prev, prompt_translation: value }))}
            isDarkMode={isDarkMode}
          />
          <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => onChange((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Conta ativa
          </label>
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
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

function FilterButton({ label, active, onClick, isDarkMode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-1.5 text-center text-xs font-medium transition md:flex-none ${
        active
          ? isDarkMode
            ? "bg-slate-600 text-slate-100"
            : "bg-white text-slate-900 shadow-sm"
          : isDarkMode
            ? "text-slate-300 hover:bg-slate-700"
            : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

function Tag({ label, isDarkMode }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
      {label}
    </span>
  );
}

function InputField({ label, value, onChange, isDarkMode }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}
      />
    </label>
  );
}

function TextField({ label, value, onChange, isDarkMode, rows = 3 }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}
      />
    </label>
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
    if (Array.isArray(detail)) {
      const first = detail[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object") {
        const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "campo";
        const message = first.msg || "valor inválido";
        return `${field}: ${message}`;
      }
      return fallback;
    }
    if (detail && typeof detail === "object") {
      if (typeof detail.detail === "string") return detail.detail;
      return fallback;
    }
    return fallback;
  }
  return err?.message || fallback;
}
