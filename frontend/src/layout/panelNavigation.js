export const PANEL_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  {
    key: "contas",
    label: "Contas",
    children: [
      { key: "contas-linkedin", label: "LinkedIn", href: "/contas/linkedin" },
      { key: "contas-github", label: "GitHub", href: "/contas/github" },
      { key: "contas-chave-api", label: "Chave API", href: "/contas/chave-api" },
    ],
  },
  {
    key: "execucao",
    label: "Execucao",
    children: [
      { key: "execucao-automacoes", label: "Automacoes", href: "/execucoes" },
      { key: "resultados", label: "Resultados", href: "/resultados" },
      { key: "executar-agora", label: "Executar Agora", href: "/executar-agora" },
      { key: "agendamentos", label: "Agendamentos", href: "/agendamentos" },
    ],
  },
  {
    key: "configuracoes",
    label: "Configuracoes",
    children: [
      { key: "prompts", label: "Prompts", href: "/configuracoes/prompts" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    children: [
      { key: "admin-dashboard", label: "Dashboard", href: "/admin/dashboard" },
      { key: "admin-usuarios", label: "Usuarios", href: "/admin/usuarios" },
      { key: "admin-execucoes", label: "Execucoes", href: "/admin/execucoes" },
      { key: "admin-consumos", label: "Consumos", href: "/admin/consumos" },
    ],
  },
];

function flatten(items) {
  return items.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])]);
}

export function getActiveKey(pathname = "") {
  const all = flatten(PANEL_NAV_ITEMS).filter((item) => item.href);
  const sorted = all.sort((a, b) => b.href.length - a.href.length);
  const active = sorted.find((item) => pathname.startsWith(item.href));
  return active?.key ?? "dashboard";
}

export function getActiveLabel(pathname = "") {
  const all = flatten(PANEL_NAV_ITEMS).filter((item) => item.href);
  const sorted = all.sort((a, b) => b.href.length - a.href.length);
  const active = sorted.find((item) => pathname.startsWith(item.href));
  return active?.label ?? "Painel";
}
