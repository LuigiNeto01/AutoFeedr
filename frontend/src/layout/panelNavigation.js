export const PANEL_NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard" },
  {
    key: "contas",
    label: "Contas",
    children: [
      { key: "contas-linkedin", label: "LinkedIn", href: "/contas/linkedin" },
      { key: "contas-github", label: "GitHub", href: "/contas/github" },
    ],
  },
  {
    key: "execucao",
    label: "Execução",
    children: [
      { key: "resultados", label: "Resultados", href: "/resultados" },
      { key: "agendamentos", label: "Agendamentos", href: "/agendamentos" },
    ],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    children: [
      { key: "prompts", label: "Prompts", href: "/configuracoes/prompts" },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    children: [
      { key: "admin-dashboard", label: "Dashboard", href: "/admin/dashboard" },
      { key: "admin-usuarios", label: "Usuários", href: "/admin/usuarios" },
      { key: "admin-execucoes", label: "Execuções", href: "/admin/execucoes" },
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
