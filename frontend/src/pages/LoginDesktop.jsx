import LoginForm from "../components/login/LoginForm";

export default function LoginDesktop() {
  return (
    <div className="min-h-screen w-full bg-[#F5EFE9] lg:grid lg:grid-cols-3">
      <div className="relative hidden overflow-hidden bg-[#1F2A24] lg:col-span-2 lg:block">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1F2A24] via-[#2D1F19] to-[#5C2A16]" />
        <div className="absolute -left-28 top-8 h-[140%] w-[120%] rounded-full bg-[#A9431E]/35 blur-3xl" />
        <div className="absolute -bottom-32 right-[-20%] h-80 w-80 rounded-full bg-[#48664E]/40 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(249,227,219,0.42),_rgba(25,25,25,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(255,255,255,0.08),_transparent)] mix-blend-screen" />

        <div className="relative flex h-full flex-col justify-between px-16 py-14 text-white">
          <div>
            <p className="font-headline text-xs uppercase tracking-[0.45em] text-white/70">
              CongonhasHUB
            </p>
            <h2 className="mt-6 max-w-xl font-headline text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Acesso ao painel de gerenciamento do Blog CongonhasHUB
            </h2>
            <p className="mt-4 max-w-lg text-base text-white/75">
              Crie, edite, publique e arquive posts. Organize conteúdo e mídia.
              Controle publicações e revise o que está no ar.
            </p>
          </div>

          <div className="flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.35em] text-white/60">
            <div className="h-px flex-1 bg-white/20" />
            <span>Acesso ao Gerenciamento</span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
        </div>
      </div>

      <div className="flex min-h-screen flex-col bg-[#F9F0E6]/70 px-6 py-10 backdrop-blur-sm lg:col-span-1 lg:px-10">
        <div className="mx-auto w-full max-w-md pb-6 pt-4">
          <div className="text-center">
            <span className="inline-flex items-center rounded-full border border-[#A9431E]/30 bg-[#A9431E]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-[#A9431E]">
              Painel do Administrador
            </span>
            <h1 className="mt-6 font-headline text-3xl font-semibold tracking-tight text-[#25352A]">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm font-medium text-[#48664E]/85">
              Entre com suas credenciais para acessar o painel.
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center pb-10">
          <LoginForm withCard={false} showHeader={false} />
        </div>
      </div>
    </div>
  );
}
