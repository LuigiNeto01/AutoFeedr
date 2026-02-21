import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRight, FaEye, FaEyeSlash } from "react-icons/fa";
import { api, ApiError } from "../../lib/api";
import { setAccessToken } from "../../lib/session";

export default function LoginForm({
  withCard = true,
  showHeader = true,
  className = "",
  isDarkMode = false,
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password });
      setAccessToken(response.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || "Falha ao autenticar.");
      } else {
        setError("Falha ao autenticar.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    `w-full rounded-2xl border px-4 py-3 shadow-[0_22px_55px_-40px_rgba(37,53,42,0.7)] transition disabled:cursor-not-allowed disabled:opacity-60 ${
      isDarkMode
        ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
        : "border-[#48664E]/25 bg-white/85 text-[#25352A] placeholder-[#48664E]/45 focus:border-[#A9431E] focus:outline-none focus:ring-2 focus:ring-[#A9431E]/35"
    }`;

  const submitLabel =
    mode === "login"
      ? loading
        ? "Entrando..."
        : "Entrar"
      : loading
        ? "Criando conta..."
        : "Criar conta";

  const content = (
    <>
      {showHeader ? (
        <div className="mb-8 text-center">
          <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.45em] ${isDarkMode ? "border-sky-500/30 bg-sky-500/10 text-sky-300" : "border-[#A9431E]/25 bg-[#A9431E]/10 text-[#A9431E]"}`}>
            login seguro
          </span>
          <h1 className={`mt-6 text-3xl font-semibold tracking-tight ${isDarkMode ? "text-slate-100" : "text-[#25352A]"}`}>
            {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
          </h1>
          <p className={`mt-2 text-sm font-medium ${isDarkMode ? "text-slate-300" : "text-[#48664E]/85"}`}>
            {mode === "login"
              ? "Entre com suas credenciais para acessar o painel."
              : "Preencha os dados para criar seu acesso."}
          </p>
        </div>
      ) : null}

      <div className={`mb-5 grid grid-cols-2 gap-2 rounded-xl p-1 ${isDarkMode ? "bg-slate-800" : "bg-[#F5EFE9]"}`}>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "login"
              ? isDarkMode
                ? "bg-slate-700 text-slate-100 shadow-sm"
                : "bg-white text-[#25352A] shadow-sm"
              : isDarkMode
                ? "text-slate-300 hover:text-slate-100"
                : "text-[#48664E] hover:text-[#25352A]"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "register"
              ? isDarkMode
                ? "bg-slate-700 text-slate-100 shadow-sm"
                : "bg-white text-[#25352A] shadow-sm"
              : isDarkMode
                ? "text-slate-300 hover:text-slate-100"
                : "text-[#48664E] hover:text-[#25352A]"
          }`}
        >
          Criar conta
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-[#EA8A7F]/40 bg-[#FDEBE8] px-4 py-3 text-sm font-medium text-[#7C2D2D] shadow-[0_24px_60px_-38px_rgba(169,67,30,0.7)]">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="sr-only">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClasses}
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="relative">
          <label htmlFor="password" className="sr-only">
            Senha
          </label>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Senha (min. 8 caracteres)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${inputClasses} pr-12`}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={loading}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((value) => !value)}
            className={`absolute inset-y-0 right-2 my-auto inline-flex cursor-pointer items-center justify-center rounded-xl p-2 transition disabled:opacity-60 ${
              isDarkMode
                ? "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                : "text-[#48664E] hover:bg-[#F1E4DA] hover:text-[#25352A]"
            }`}
            disabled={loading}
          >
            {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.35em] text-white transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
            isDarkMode
              ? "bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 shadow-[0_30px_60px_-32px_rgba(37,99,235,0.8)] hover:shadow-[0_35px_75px_-32px_rgba(37,99,235,0.9)] focus-visible:outline-sky-500"
              : "bg-gradient-to-r from-[#A9431E] via-[#C45730] to-[#A9431E] shadow-[0_30px_60px_-32px_rgba(169,67,30,0.8)] hover:shadow-[0_35px_75px_-32px_rgba(169,67,30,0.9)] focus-visible:outline-[#A9431E]"
          }`}
        >
          {submitLabel}
          {!loading ? (
            <FaArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
          ) : null}
        </button>
      </form>
    </>
  );

  if (withCard) {
    return (
      <div
        className={`w-full max-w-md rounded-3xl border p-8 shadow-[0_40px_120px_-60px_rgba(37,53,42,0.75)] backdrop-blur-lg sm:p-10 ${
          isDarkMode
            ? "border-slate-700/80 bg-slate-900/85"
            : "border-white/40 bg-white/80"
        } ${className}`}
      >
        {content}
      </div>
    );
  }

  return <div className={`w-full max-w-md ${className}`}>{content}</div>;
}
