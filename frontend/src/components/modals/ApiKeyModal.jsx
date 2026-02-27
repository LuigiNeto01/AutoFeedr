import { useEffect, useState } from "react";
import { api, ApiError } from "../../lib/api";

export default function ApiKeyModal({ open, onClose, isDarkMode = false }) {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadStatus() {
    setLoading(true);
    try {
      const response = await api.openaiKeyStatus();
      setHasKey(Boolean(response?.has_openai_api_key));
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao carregar status da chave API."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadStatus();
    setShow(false);
    setKeyValue("");
    setSuccess("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = keyValue.trim();
    if (!trimmed) {
      setError("Informe uma chave API valida.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await api.setOpenaiKey({ api_key: trimmed });
      const hasSaved = Boolean(response?.has_openai_api_key ?? true);
      setHasKey(hasSaved);
      setKeyValue("");
      setShow(false);
      setSuccess("Chave API salva com sucesso.");
    } catch (err) {
      setError(getErrorMessage(err, "Falha ao salvar chave API."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar modal"
      />

      <div className={`relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-4 shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className={`text-lg font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              Chave API
            </h3>
            <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {hasKey ? "Chave configurada" : "Nenhuma chave configurada"}
            </p>
          </div>
          <button
            type="button"
            onClick={loadStatus}
            disabled={loading}
            className={`rounded-lg border px-3 py-2 text-sm transition ${isDarkMode ? "border-slate-600 text-slate-200 hover:bg-slate-800" : "border-slate-300 text-slate-700 hover:bg-slate-100"}`}
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {error ? (
          <div className={`mb-3 rounded-xl border px-4 py-2 text-sm ${isDarkMode ? "border-red-900/60 bg-red-950/40 text-red-200" : "border-red-200 bg-red-50 text-red-700"}`}>
            {error}
          </div>
        ) : null}

        {success ? (
          <div className={`mb-3 rounded-xl border px-4 py-2 text-sm ${isDarkMode ? "border-emerald-900/60 bg-emerald-950/40 text-emerald-200" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {success}
          </div>
        ) : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className={`mb-1 block text-xs font-medium ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
              Chave OpenAI
            </span>
            <input
              type={show ? "text" : "password"}
              value={keyValue}
              onChange={(event) => setKeyValue(event.target.value)}
              placeholder="sk-..."
              className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-400 focus:border-sky-500" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-slate-900"}`}
            />
          </label>

          <label className={`inline-flex items-center gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
            <input
              type="checkbox"
              checked={show}
              onChange={(event) => setShow(event.target.checked)}
            />
            Mostrar chave
          </label>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
            <button
              type="submit"
              disabled={saving}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${isDarkMode ? "bg-sky-600 hover:bg-sky-500" : "bg-slate-900 hover:bg-slate-700"}`}
            >
              {saving ? "Salvando..." : hasKey ? "Atualizar chave" : "Salvar chave"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${isDarkMode ? "bg-slate-700 text-slate-100 hover:bg-slate-600" : "bg-slate-200 text-slate-800 hover:bg-slate-300"}`}
            >
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
        const message = first.msg || "valor invalido";
        return `${field}: ${message}`;
      }
    }
  }
  return err?.message || fallback;
}
