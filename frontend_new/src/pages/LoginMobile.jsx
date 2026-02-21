import LoginForm from "../components/login/LoginForm";

export default function LoginMobile() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gradient-to-b from-[#F5EFE9] via-[#F9E6DC] to-[#F5EFE9] px-4 py-12">
      <div className="mx-auto w-full max-w-xs text-center">
        <span className="inline-flex items-center justify-center rounded-full border border-[#A9431E]/25 bg-[#A9431E]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-[#A9431E]">
          login seguro
        </span>
        <h1 className="mt-5 font-headline text-3xl font-semibold tracking-tight text-[#25352A]">
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-sm font-medium text-[#48664E]/85">
          Use seu acesso exclusivo para continuar.
        </p>
      </div>

      <div className="mt-10 flex flex-1 items-center justify-center">
        <LoginForm
          withCard
          showHeader={false}
          className="border border-white/50 bg-white/85 shadow-[0_25px_60px_-35px_rgba(37,53,42,0.65)]"
        />
      </div>
    </div>
  );
}
