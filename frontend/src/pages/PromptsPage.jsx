import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError } from "../lib/api";

export default function PromptsPage() {
  const isDarkMode = useOutletContext()?.isDarkMode ?? false;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [defaults, setDefaults] = useState(null);
  const [solutionPrompt, setSolutionPrompt] = useState("");
  const [llmPrefs, setLlmPrefs] = useState(null);
  const [selectedModel, setSelectedModel] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [defaultsData, leetcodePromptData, llmPrefsData] = await Promise.all([
        api.prompts(),
        api.leetcodePrompts(),
        api.llmPreferences(),
      ]);
      setDefaults(defaultsData ?? null);
      setLlmPrefs(llmPrefsData ?? null);
      setSelectedModel(llmPrefsData?.selected_model || llmPrefsData?.effective_model || "");
      setSolutionPrompt(
        leetcodePromptData?.solution_prompt ||
          defaultsData?.leetcode_solution_prompt ||
          "",
      );
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar prompts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (solutionPrompt.trim().length < 20) {
      setError("O prompt deve ter no mínimo 20 caracteres.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await Promise.all([
        api.updateLeetcodePrompts({ solution_prompt: solutionPrompt.trim() }),
        api.updateLlmPreferences({ selected_model: selectedModel || null }),
      ]);
      setSuccess("Prompt de solução LeetCode e modelo preferido atualizados.");
      const refreshedPrefs = await api.llmPreferences();
      setLlmPrefs(refreshedPrefs ?? null);
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar prompt."));
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

      <section className={`rounded-3xl border p-5 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <p className={`text-xs uppercase tracking-[0.22em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Configurações</p>
        <h2 className={`mt-1 text-2xl font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Prompts</h2>
        <p className={`mt-1 text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Visualize defaults e ajuste o prompt de solução LeetCode.</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Defaults do backend</h3>
          <div className="space-y-3">
            <TextAreaField label="Prompt de geração" value={defaults?.prompt_generation || ""} readOnly isDarkMode={isDarkMode} rows={8} />
            <TextAreaField label="Prompt de tradução (LinkedIn)" value={defaults?.prompt_translation || ""} readOnly isDarkMode={isDarkMode} rows={8} />
          </div>
        </section>

        <section className={`rounded-2xl border p-4 shadow-sm ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <h3 className={`mb-3 text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Prompt de solução LeetCode</h3>
          <form className="space-y-3" onSubmit={handleSave}>
            <label className="block">
              <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                Modelo de IA (permitido pela plataforma)
              </span>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}
              >
                {(llmPrefs?.allowed_models || []).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <p className={`mt-1 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Modelo efetivo atual: {llmPrefs?.effective_model || "-"}
              </p>
            </label>
            <TextAreaField
              label="Template editável"
              value={solutionPrompt}
              onChange={setSolutionPrompt}
              isDarkMode={isDarkMode}
              rows={18}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
              >
                {saving ? "Salvando..." : "Salvar prompt"}
              </button>
              <button
                type="button"
                onClick={() => setSolutionPrompt(defaults?.leetcode_solution_prompt || "")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
              >
                Restaurar padrão
              </button>
            </div>
          </form>
        </section>
      </section>
    </div>
  );
}

function TextAreaField({ label, value, onChange, isDarkMode, rows = 5, readOnly = false }) {
  return (
    <label className="block">
      <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 focus:border-slate-900"}`}
      />
    </label>
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

function getErrorMessage(err, fallback) {
  if (err instanceof ApiError && typeof err.detail === "string") return err.detail || fallback;
  return err?.message || fallback;
}
