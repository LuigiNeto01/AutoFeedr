import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { HiOutlineMenuAlt2 } from "react-icons/hi";
import Sidebar from "./Sidebar";
import { PANEL_NAV_ITEMS, getActiveKey, getActiveLabel } from "./panelNavigation";
import { api } from "../lib/api";
import { clearAccessToken } from "../lib/session";
import { applyTheme, getSavedTheme, saveTheme } from "../lib/theme";
import ApiKeyModal from "../components/modals/ApiKeyModal";

export default function PanelLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return getSavedTheme() === "dark";
  });

  const activeKey = getActiveKey(location.pathname);
  const pageTitle = useMemo(() => getActiveLabel(location.pathname), [location.pathname]);
  const navItems = useMemo(() => {
    const isAdmin = (user?.role ?? "user") === "admin";
    return PANEL_NAV_ITEMS
      .filter((item) => (isAdmin ? true : item.key !== "admin"))
      .map((item) => {
        if (item.key !== "contas") return item;
        return {
          ...item,
          children: (item.children || []).filter((child) =>
            isAdmin ? true : child.key !== "contas-chave-api",
          ),
        };
      });
  }, [user]);

  const handleSelect = (item) => {
    if (item?.key === "contas-chave-api") {
      if ((user?.role ?? "user") !== "admin") {
        navigate("/configuracoes/prompts");
        setIsMobileSidebarOpen(false);
        return;
      }
      setIsApiKeyModalOpen(true);
      setIsMobileSidebarOpen(false);
      return;
    }
    navigate(item.href);
    setIsMobileSidebarOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((result) => {
        if (!cancelled) setUser(result);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const theme = isDarkMode ? "dark" : "light";
    applyTheme(theme);
    saveTheme(theme);
  }, [isDarkMode]);

  const handleLogout = async () => {
    await api.logout();
    clearAccessToken();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`flex h-dvh overflow-hidden ${isDarkMode ? "bg-slate-900" : "bg-slate-100"}`}>
      <div className="hidden h-full md:block">
        <Sidebar
          open={isSidebarExpanded}
          onToggle={() => setIsSidebarExpanded((value) => !value)}
          items={navItems}
          activeKey={activeKey}
          onSelect={handleSelect}
          onLogout={handleLogout}
          user={user}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((value) => !value)}
        />
      </div>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={`sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 md:px-6 ${
            isDarkMode ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg md:hidden ${
              isDarkMode
                ? "text-slate-300 hover:bg-slate-800"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            aria-label="Abrir menu"
          >
            <HiOutlineMenuAlt2 className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <p
              className={`text-xs uppercase tracking-[0.2em] ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              AutoFeedr
            </p>
            <h1 className={`truncate text-base font-semibold ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              {pageTitle}
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet context={{ isDarkMode }} />
        </div>
      </main>

      {isMobileSidebarOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="absolute inset-0 bg-black/40"
            aria-label="Fechar menu"
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar
              open
              variant="mobile"
              items={navItems}
              activeKey={activeKey}
              onSelect={handleSelect}
              onLogout={handleLogout}
              user={user}
              isDarkMode={isDarkMode}
              onToggleDarkMode={() => setIsDarkMode((value) => !value)}
              onClose={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <ApiKeyModal
        open={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
