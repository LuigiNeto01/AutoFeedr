import LoginForm from "../components/login/LoginForm";
import { getSavedTheme } from "../lib/theme";

export default function LoginPage() {
  const isDarkMode = getSavedTheme() === "dark";

  return (
    <div className={`min-h-screen w-full lg:grid lg:grid-cols-3 ${isDarkMode ? "bg-slate-950" : "bg-[#F5EFE9]"}`}>
      <div className={`relative hidden overflow-hidden lg:col-span-2 lg:block ${isDarkMode ? "bg-slate-950" : "bg-[#1F2A24]"}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F2A24] via-[#2D1F19] to-[#5C2A16]" />
        <div className={`absolute -left-28 top-8 h-[140%] w-[120%] rounded-full blur-3xl ${isDarkMode ? "bg-sky-500/20" : "bg-[#A9431E]/35"}`} />
        <div className={`absolute -bottom-32 right-[-20%] h-80 w-80 rounded-full blur-3xl ${isDarkMode ? "bg-indigo-500/25" : "bg-[#48664E]/40"}`} />
        <div className={`absolute inset-0 ${isDarkMode ? "bg-[radial-gradient(circle_at_top,_rgba(186,230,253,0.22),_rgba(2,6,23,0))]" : "bg-[radial-gradient(circle_at_top,_rgba(249,227,219,0.42),_rgba(25,25,25,0))]"}`} />
        <div className="relative flex h-full flex-col justify-between px-16 py-14 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.45em] text-white/70">AutoFeedr</p>
            <h2 className="mt-6 max-w-xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Acesse seu painel para gerenciar automacoes e conteudo
            </h2>
            <p className="mt-4 max-w-lg text-base text-white/75">
              Login e criacao de conta em um unico fluxo, usando os endpoints do backend.
            </p>
          </div>
        </div>
      </div>

      <div className={`flex min-h-screen flex-col px-6 py-10 backdrop-blur-sm lg:col-span-1 lg:px-10 ${isDarkMode ? "bg-slate-900/70" : "bg-[#F9F0E6]/70"}`}>
        <div className="flex flex-1 items-center justify-center">
          <LoginForm withCard isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}
