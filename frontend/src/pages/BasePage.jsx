export default function BasePage({ title }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        Tela base pronta. Aqui você pode migrar o conteúdo da página antiga do frontend.
      </p>
    </section>
  );
}
