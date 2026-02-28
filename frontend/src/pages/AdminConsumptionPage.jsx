import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";

const DEFAULT_NEW_MODEL = {
  model: "",
  input_price_per_1m: 0,
  cached_input_price_per_1m: 0,
  output_price_per_1m: 0,
  is_enabled: true,
};

export default function AdminConsumptionPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [range, setRange] = useState("30d");
  const [granularity, setGranularity] = useState("daily");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [overview, setOverview] = useState(null);
  const [usersTable, setUsersTable] = useState([]);
  const [series, setSeries] = useState([]);
  const [users, setUsers] = useState([]);
  const [llmSettings, setLlmSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);

  const panel = isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white";
  const card = isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50";
  const txt = isDarkMode ? "text-slate-100" : "text-slate-900";
  const sub = isDarkMode ? "text-slate-400" : "text-slate-500";

  async function loadAll({ silent = false } = {}) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [usersRes, overviewRes, tableRes, seriesRes, llmSettingsRes] = await Promise.all([
        api.adminUsers(),
        api.adminConsumptionOverview(range),
        api.adminConsumptionUsersTable(range, 100),
        api.adminConsumptionByUser({
          range,
          granularity,
          user_id: selectedUserId ? Number(selectedUserId) : undefined,
          top_n: 5,
        }),
        api.adminLlmSettings(),
      ]);
      setUsers(usersRes ?? []);
      setOverview(overviewRes ?? null);
      setUsersTable(tableRes ?? []);
      setSeries(seriesRes ?? []);
      setLlmSettings(llmSettingsRes ?? null);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar consumos."));
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!loading) loadAll({ silent: true });
  }, [range, granularity, selectedUserId]);

  const chartData = useMemo(() => {
    const rows = {};
    for (const userSeries of series) {
      const label = userSeries.email || `user-${userSeries.user_id ?? "?"}`;
      for (const point of userSeries.points || []) {
        if (!rows[point.bucket]) rows[point.bucket] = { bucket: point.bucket };
        rows[point.bucket][label] = point.total_tokens;
      }
    }
    return Object.values(rows).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)));
  }, [series]);

  const lineKeys = useMemo(
    () => series.map((item) => item.email || `user-${item.user_id ?? "?"}`),
    [series],
  );

  if (loading) {
    return <div className={`h-64 animate-pulse rounded-2xl ${isDarkMode ? "bg-slate-800/70" : "bg-slate-200/70"}`} />;
  }

  return (
    <div className="space-y-5">
      {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}

      <section className={`rounded-3xl border p-5 shadow-sm ${panel}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${sub}`}>Admin</p>
            <h2 className={`mt-1 text-2xl font-semibold ${txt}`}>Consumos</h2>
            <p className={`mt-1 text-sm ${sub}`}>Tokens, custos estimados, modelos mais usados e consumo por usuário.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              Configurar LLM central
            </button>
            <button
              type="button"
              onClick={() => loadAll({ silent: true })}
              className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
            >
              {refreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requests" value={overview?.requests ?? 0} isDarkMode={isDarkMode} />
        <Stat label="Input tokens" value={formatInt(overview?.input_tokens ?? 0)} isDarkMode={isDarkMode} />
        <Stat label="Output tokens" value={formatInt(overview?.output_tokens ?? 0)} isDarkMode={isDarkMode} />
        <Stat label="Total tokens" value={formatInt(overview?.total_tokens ?? 0)} isDarkMode={isDarkMode} />
        <Stat label="Cached input" value={formatInt(overview?.cached_input_tokens ?? 0)} isDarkMode={isDarkMode} />
        <Stat label="Custo estimado (USD)" value={`$${Number(overview?.estimated_cost_usd ?? 0).toFixed(4)}`} isDarkMode={isDarkMode} />
        <Stat label="Provider" value={llmSettings?.provider || "openai"} isDarkMode={isDarkMode} />
        <Stat label="Modelo padrão" value={llmSettings?.default_model || "-"} isDarkMode={isDarkMode} />
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-5 ${panel}`}>
          <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Modelos mais usados</h3>
          <div className="space-y-2">
            {(overview?.top_models || []).length === 0 ? (
              <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Sem uso registrado ainda.</p>
            ) : (
              overview.top_models.map((item) => (
                <div key={item.model} className={`rounded-xl border p-3 ${card}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm font-semibold ${txt}`}>{item.model}</p>
                    <span className={`text-xs ${sub}`}>{item.requests} req</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <span className={sub}>In: {formatInt(item.input_tokens)}</span>
                    <span className={sub}>Cached: {formatInt(item.cached_input_tokens)}</span>
                    <span className={sub}>Out: {formatInt(item.output_tokens)}</span>
                    <span className={sub}>USD: ${Number(item.estimated_cost_usd || 0).toFixed(4)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm xl:col-span-7 ${panel}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className={`mr-auto text-lg font-semibold ${txt}`}>Consumo por usuário</h3>
            <select value={range} onChange={(e) => setRange(e.target.value)} className={`${selectClass(isDarkMode)} w-full sm:w-auto`}>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
            <select value={granularity} onChange={(e) => setGranularity(e.target.value)} className={`${selectClass(isDarkMode)} w-full sm:w-auto`}>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className={`${selectClass(isDarkMode)} w-full sm:w-auto`}>
              <option value="">Top usuários</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  #{user.id} - {user.email}
                </option>
              ))}
            </select>
          </div>

          <div className={`h-72 rounded-xl border p-2 ${card}`}>
            {chartData.length === 0 ? (
              <div className={`flex h-full items-center justify-center text-sm ${sub}`}>Sem dados para o período.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="bucket" stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 11 }} />
                  <YAxis stroke={isDarkMode ? "#94a3b8" : "#64748b"} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {lineKeys.map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-4 shadow-sm ${panel}`}>
        <h3 className={`mb-3 text-lg font-semibold ${txt}`}>Ranking por usuário</h3>
        {(usersTable || []).length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${card} ${sub}`}>Sem dados de consumo registrados.</p>
        ) : (
          <div className="space-y-2">
            {usersTable.map((row) => (
              <div key={`u-${row.user_id ?? "none"}`} className={`rounded-xl border p-3 ${card}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-semibold ${txt}`}>{row.email || `Usuario #${row.user_id ?? "-"}`}</p>
                    <p className={`truncate text-xs ${sub}`}>Modelo mais usado: {row.most_used_model || "-"}</p>
                  </div>
                  <div className={`text-right text-xs ${sub}`}>
                    <div>{row.requests} req</div>
                    <div>${Number(row.estimated_cost_usd || 0).toFixed(4)}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <span className={sub}>Input: {formatInt(row.input_tokens)}</span>
                  <span className={sub}>Cached: {formatInt(row.cached_input_tokens)}</span>
                  <span className={sub}>Output: {formatInt(row.output_tokens)}</span>
                  <span className={sub}>Total: {formatInt(row.total_tokens)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <AdminLlmSettingsModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        isDarkMode={isDarkMode}
        settings={llmSettings}
        onSaved={async () => {
          setConfigOpen(false);
          await loadAll({ silent: true });
        }}
      />
    </div>
  );
}

function AdminLlmSettingsModal({ open, onClose, isDarkMode, settings, onSaved }) {
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState("");
  const [models, setModels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!open) return;
    setProvider(settings?.provider || "openai");
    setDefaultModel(settings?.default_model || "gpt-5-nano");
    setModels((settings?.models || []).map((m) => ({ ...m })));
    setApiKey("");
    setShowKey(false);
    setError("");
    setSuccess("");
  }, [open, settings]);

  if (!open) return null;

  const updateModel = (idx, patch) => {
    setModels((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const addModel = () => {
    setModels((prev) => [...prev, { ...DEFAULT_NEW_MODEL }]);
  };

  const removeModel = (idx) => {
    setModels((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        provider,
        api_key: apiKey.trim() || null,
        default_model: defaultModel.trim() || null,
        models: models.map((item) => ({
          model: String(item.model || "").trim(),
          input_price_per_1m: Number(item.input_price_per_1m || 0),
          cached_input_price_per_1m: Number(item.cached_input_price_per_1m || 0),
          output_price_per_1m: Number(item.output_price_per_1m || 0),
          is_enabled: Boolean(item.is_enabled),
        })),
      };
      await api.updateAdminLlmSettings(payload);
      setSuccess("Configuração central de LLM salva.");
      await onSaved?.();
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar configuração LLM."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/60" aria-label="Fechar" />
      <div className={`relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Configurar LLM central</h3>
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Chave central da plataforma + lista de modelos disponíveis e pricing por 1M tokens.</p>
          </div>
          <button type="button" onClick={onClose} className={`rounded-lg px-3 py-2 text-sm ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}>Fechar</button>
        </div>

        {error ? <Message tone="error" text={error} isDarkMode={isDarkMode} /> : null}
        {success ? <Message tone="success" text={success} isDarkMode={isDarkMode} /> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <section className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50"}`}>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className={`mb-1 block text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>Provider</span>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className={selectClass(isDarkMode)}>
                  <option value="openai">openai</option>
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className={`mb-1 block text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>API key central (opcional para manter a atual)</span>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-proj-..."
                  className={inputClass(isDarkMode)}
                />
                <label className={`mt-1 inline-flex items-center gap-2 text-xs ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} />
                  Mostrar chave
                </label>
              </label>
            </div>
          </section>

          <section className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/40" : "border-slate-200 bg-slate-50"}`}>
            <div className="mb-2 flex items-center justify-between">
              <h4 className={`text-sm font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Modelos disponíveis</h4>
              <button type="button" onClick={addModel} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${isDarkMode ? "bg-sky-600 text-white" : "bg-slate-900 text-white"}`}>Adicionar modelo</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={isDarkMode ? "text-slate-300" : "text-slate-700"}>
                    <th className="px-2 py-2 text-left">Ativo</th>
                    <th className="px-2 py-2 text-left">Model</th>
                    <th className="px-2 py-2 text-left">Input</th>
                    <th className="px-2 py-2 text-left">Cached input</th>
                    <th className="px-2 py-2 text-left">Output</th>
                    <th className="px-2 py-2 text-left">Default</th>
                    <th className="px-2 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((row, idx) => (
                    <tr key={`model-${idx}`} className={`border-t ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={Boolean(row.is_enabled)} onChange={(e) => updateModel(idx, { is_enabled: e.target.checked })} />
                      </td>
                      <td className="px-2 py-2">
                        <input value={row.model || ""} onChange={(e) => updateModel(idx, { model: e.target.value })} className={inputClass(isDarkMode)} />
                      </td>
                      <td className="px-2 py-2">
                        <PriceInput value={row.input_price_per_1m} onChange={(v) => updateModel(idx, { input_price_per_1m: v })} isDarkMode={isDarkMode} />
                      </td>
                      <td className="px-2 py-2">
                        <PriceInput value={row.cached_input_price_per_1m} onChange={(v) => updateModel(idx, { cached_input_price_per_1m: v })} isDarkMode={isDarkMode} />
                      </td>
                      <td className="px-2 py-2">
                        <PriceInput value={row.output_price_per_1m} onChange={(v) => updateModel(idx, { output_price_per_1m: v })} isDarkMode={isDarkMode} />
                      </td>
                      <td className="px-2 py-2">
                        <input type="radio" name="defaultModel" checked={defaultModel === row.model} onChange={() => setDefaultModel(row.model)} />
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removeModel(idx)} className={`rounded-lg px-2 py-1 text-xs ${isDarkMode ? "bg-red-900/50 text-red-200" : "bg-red-100 text-red-700"}`}>Remover</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`mt-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Preços em USD por 1M tokens (Input / Cached input / Output). Exemplo atual: gpt-5-nano = 0.05 / 0.005 / 0.40
            </p>
          </section>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={`rounded-xl px-4 py-2 text-sm font-semibold ${isDarkMode ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-800"}`}>Cancelar</button>
            <button type="submit" disabled={saving} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"} disabled:opacity-60`}>
              {saving ? "Salvando..." : "Salvar configuração"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PriceInput({ value, onChange, isDarkMode }) {
  return (
    <input
      type="number"
      min="0"
      step="0.000001"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value || 0))}
      className={inputClass(isDarkMode)}
    />
  );
}

function Stat({ label, value, isDarkMode }) {
  return (
    <div className={`rounded-xl border p-3 ${isDarkMode ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-xs uppercase tracking-wide ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Message({ tone, text, isDarkMode }) {
  const styles = tone === "error"
    ? isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"
    : isDarkMode ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>{text}</div>;
}

function inputClass(isDarkMode) {
  return `w-full rounded-lg border px-2 py-1.5 text-sm ${isDarkMode ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`;
}

function selectClass(isDarkMode) {
  return `rounded-lg border px-3 py-2 text-sm ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100" : "border-slate-300 bg-white text-slate-900"}`;
}

function formatInt(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function getErrorMessage(err, fallback) {
  if (typeof err?.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}

const LINE_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#a78bfa", "#22c55e"];
