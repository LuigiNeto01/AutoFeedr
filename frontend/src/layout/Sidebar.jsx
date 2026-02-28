import { forwardRef, useCallback, useMemo, useState } from "react";
import {
  HiOutlineChevronDoubleLeft,
  HiOutlineChevronDoubleRight,
  HiOutlineBriefcase,
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineCog6Tooth,
  HiOutlineUserCircle,
  HiOutlineXMark,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineShieldCheck,
} from "react-icons/hi2";

const APP_NAME = "AutoFeedr";
const FALLBACK_ICON = HiOutlineDocumentText;

const ICONS = {
  dashboard: HiOutlineHome,
  contas: HiOutlineBriefcase,
  "contas-linkedin": HiOutlineBriefcase,
  "contas-github": HiOutlineDocumentText,
  execucao: HiOutlineDocumentText,
  resultados: HiOutlineDocumentText,
  agendamentos: HiOutlineDocumentText,
  configuracoes: HiOutlineCog6Tooth,
  prompts: HiOutlineDocumentText,
  admin: HiOutlineShieldCheck,
  "admin-usuarios": HiOutlineShieldCheck,
  "admin-dashboard": HiOutlineShieldCheck,
  "admin-execucoes": HiOutlineShieldCheck,
  "admin-consumos": HiOutlineShieldCheck,
};

function LogoArea({
  open,
  onToggle,
  onClose,
  showToggle = true,
  showClose = false,
  appName = APP_NAME,
  isDarkMode = false,
}) {
  const actionButton = showClose ? (
    <button
      type="button"
      aria-label="Fechar sidebar"
      onClick={onClose}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors ${
        isDarkMode ? "text-slate-300 hover:bg-slate-800 hover:text-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <HiOutlineXMark className="h-5 w-5 shrink-0" aria-hidden="true" />
    </button>
  ) : showToggle ? (
    <button
      type="button"
      aria-label={open ? "Recolher sidebar" : "Expandir sidebar"}
      onClick={onToggle}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors ${
        isDarkMode ? "text-slate-300 hover:bg-slate-800 hover:text-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {open ? (
        <HiOutlineChevronDoubleLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
      ) : (
        <HiOutlineChevronDoubleRight className="h-5 w-5 shrink-0" aria-hidden="true" />
      )}
    </button>
  ) : null;

  return (
    <div
      className={`flex min-h-[72px] items-center justify-between border-b px-2 py-2 ${
        isDarkMode ? "border-slate-700" : "border-slate-200"
      }`}
    >
      <div className="flex flex-1 items-center justify-center">
        {open ? (
          <span
            className={`ml-3 truncate text-base font-bold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
            title={appName}
          >
            {appName}
          </span>
        ) : null}
      </div>
      {actionButton}
    </div>
  );
}

function UserDock({
  open,
  user,
  showActions,
  onToggleActions,
  onCloseActions,
  onLogout,
  isDarkMode = false,
  onToggleDarkMode,
}) {
  const userName = user?.name ?? "Usuário";
  const userEmail = user?.email ?? "";

  const handleLogout = () => {
    onCloseActions?.();
    onLogout?.();
  };

  return (
    <div
      className={`relative flex min-h-[72px] items-center justify-between gap-2 border-t px-3 py-3 ${
        isDarkMode ? "border-slate-700" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <HiOutlineUserCircle
          className={`h-8 w-8 shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
          aria-hidden="true"
        />
        {open ? (
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{userName}</p>
            {userEmail ? (
              <p className={`truncate text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {userEmail}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Configurações"
            onClick={onToggleActions}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors ${
              isDarkMode ? "text-slate-300 hover:bg-slate-800 hover:text-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <HiOutlineCog6Tooth className="h-5 w-5 shrink-0" aria-hidden="true" />
          </button>
          <div
            className={`absolute bottom-20 right-3 w-44 rounded-xl border p-2 shadow-lg transition-all duration-200 ease-out ${
              isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
            } ${
              showActions
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-1 scale-95 opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={onToggleDarkMode}
              className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>Dark mode</span>
              <span className={`text-xs ${isDarkMode ? "text-emerald-300" : "text-slate-500"}`}>
                {isDarkMode ? "ON" : "OFF"}
              </span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>Sair</span>
              <HiOutlineChevronDoubleRight
                className={`h-4 w-4 rotate-180 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function isItemActive(item, activeKey) {
  if (item.key === activeKey) return true;
  if (!item.children) return false;
  return item.children.some((child) => child.key === activeKey);
}

const Sidebar = forwardRef(function Sidebar(
  {
    open,
    onToggle,
    onClose,
    items = [],
    activeKey,
    onSelect,
    onLogout,
    user,
    isDarkMode = false,
    onToggleDarkMode,
    variant = "desktop",
  },
  ref,
) {
  const isMobile = variant === "mobile";
  const [showActions, setShowActions] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState("execucao");

  const handleToggle = useCallback(() => {
    if (open) setShowActions(false);
    onToggle?.();
  }, [open, onToggle]);

  const handleToggleActions = useCallback(() => setShowActions((value) => !value), []);
  const handleCloseActions = useCallback(() => setShowActions(false), []);

  const renderedItems = useMemo(() => items, [items]);

  return (
    <aside
      ref={ref}
      className={[
        "z-50 flex h-dvh shrink-0 flex-col border-r shadow-sm transition-all duration-200",
        "pointer-events-auto",
        isDarkMode ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white",
        isMobile ? "w-full" : open ? "w-72" : "w-16",
      ].join(" ")}
    >
      <LogoArea
        open={open}
        onToggle={handleToggle}
        onClose={onClose}
        showToggle={!isMobile}
        showClose={isMobile}
        isDarkMode={isDarkMode}
      />

      <nav aria-label="Principal" className="mt-2 flex-1 overflow-y-auto px-2">
        <div className="flex min-h-full flex-col">
          {renderedItems.map((item) => {
            const Icon = ICONS[item.key] ?? FALLBACK_ICON;
            const active = isItemActive(item, activeKey);
            const hasChildren = Array.isArray(item.children) && item.children.length > 0;
            const isExpanded = openGroupKey === item.key;

            const handleClick = () => {
              if (hasChildren) {
                if (!open) {
                  setOpenGroupKey(null);
                  onSelect?.(item.children[0]);
                  return;
                }
                setOpenGroupKey((prev) => (prev === item.key ? null : item.key));
                return;
              }
              setOpenGroupKey(null);
              onSelect?.(item);
            };

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={handleClick}
                  title={!open ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "group relative isolate my-2 flex w-full items-center rounded-xl border text-sm font-medium backdrop-blur-sm transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                    open ? "justify-start gap-4 px-4 py-3" : "justify-center py-3",
                    active
                      ? isDarkMode
                        ? "-translate-y-0.5 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-[0_18px_28px_-18px_rgba(15,23,42,0.95)]"
                        : "-translate-y-0.5 border-slate-300 bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-[0_18px_28px_-18px_rgba(15,23,42,0.45)]"
                      : isDarkMode
                        ? "border-slate-700/80 bg-slate-900/70 text-slate-300 shadow-[0_10px_20px_-20px_rgba(148,163,184,0.9)] hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100 hover:shadow-[0_20px_28px_-18px_rgba(15,23,42,0.95)]"
                        : "border-slate-200 bg-white/95 text-slate-600 shadow-[0_10px_20px_-20px_rgba(15,23,42,0.45)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900 hover:shadow-[0_20px_28px_-18px_rgba(15,23,42,0.35)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      isDarkMode
                        ? "bg-gradient-to-r from-sky-400/15 via-transparent to-indigo-400/10"
                        : "bg-gradient-to-r from-sky-500/10 via-transparent to-indigo-500/10",
                    ].join(" ")}
                  />
                  <span
                    aria-hidden="true"
                    className={[
                      "pointer-events-none absolute inset-x-4 -bottom-1 h-4 rounded-full blur-lg transition-opacity duration-300",
                      active ? "opacity-70" : "opacity-0 group-hover:opacity-60",
                      isDarkMode ? "bg-sky-300/20" : "bg-sky-500/20",
                    ].join(" ")}
                  />
                  <Icon className="relative z-10 h-6 w-6 shrink-0" aria-hidden="true" />
                  <span className={`relative z-10 ${open ? "truncate" : "sr-only"}`}>{item.label}</span>
                  {open && hasChildren ? (
                    isExpanded ? (
                      <HiOutlineChevronDown className="relative z-10 ml-auto h-4 w-4" />
                    ) : (
                      <HiOutlineChevronRight className="relative z-10 ml-auto h-4 w-4" />
                    )
                  ) : null}
                </button>

                {open && hasChildren ? (
                  <div
                    className={`mb-1 ml-4 overflow-hidden border-l pl-2 transition-all duration-200 ease-out ${
                      isDarkMode ? "border-slate-700" : "border-slate-200"
                    } ${
                      isExpanded
                        ? "max-h-64 translate-y-0 opacity-100"
                        : "max-h-0 -translate-y-1 opacity-0"
                    }`}
                  >
                    {item.children.map((child) => {
                      const ChildIcon = ICONS[child.key] ?? FALLBACK_ICON;
                      const childActive = child.key === activeKey;
                      return (
                        <button
                          key={child.key}
                          type="button"
                          onClick={() => onSelect?.(child)}
                          className={[
                            "group relative isolate my-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm backdrop-blur-sm transition-all duration-300 ease-out",
                            childActive
                              ? isDarkMode
                                ? "-translate-y-0.5 border-slate-600 bg-slate-800 font-semibold text-slate-100 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.95)]"
                                : "-translate-y-0.5 border-slate-300 bg-slate-100 font-semibold text-slate-900 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)]"
                              : isDarkMode
                                ? "border-slate-700 bg-slate-900/70 text-slate-300 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100"
                                : "border-slate-200 bg-white/95 text-slate-600 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-slate-900",
                          ].join(" ")}
                        >
                          <span
                            aria-hidden="true"
                            className={[
                              "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300",
                              childActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                              isDarkMode
                                ? "bg-gradient-to-r from-sky-400/10 via-transparent to-indigo-400/10"
                                : "bg-gradient-to-r from-sky-500/10 via-transparent to-indigo-500/10",
                            ].join(" ")}
                          />
                          <ChildIcon className="relative z-10 h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="relative z-10">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </nav>

      <UserDock
        open={open}
        user={user}
        showActions={showActions}
        onToggleActions={handleToggleActions}
        onCloseActions={handleCloseActions}
        onLogout={onLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </aside>
  );
});

export default Sidebar;
