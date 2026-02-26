import { createBrowserRouter, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import LinkedinAccountsPage from "./pages/LinkedinAccountsPage";
import GithubAccountsPage from "./pages/GithubAccountsPage";
import AutomationsPage from "./pages/AutomationsPage";
import ResultsPage from "./pages/ResultsPage";
import RunNowPage from "./pages/RunNowPage";
import SchedulesPage from "./pages/SchedulesPage";
import PromptsPage from "./pages/PromptsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminExecutionsPage from "./pages/AdminExecutionsPage";
import AdminConsumptionPage from "./pages/AdminConsumptionPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PanelLayout from "./layout/PanelLayout";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/contas", element: <Navigate to="/contas/linkedin" replace /> },
          { path: "/contas/linkedin", element: <LinkedinAccountsPage /> },
          { path: "/contas/github", element: <GithubAccountsPage /> },
          { path: "/contas/chave-api", element: <Navigate to="/contas/linkedin" replace /> },
          { path: "/automacoes", element: <Navigate to="/execucoes" replace /> },
          { path: "/execucoes", element: <AutomationsPage /> },
          { path: "/executar-agora", element: <RunNowPage /> },
          { path: "/agendamentos", element: <SchedulesPage /> },
          { path: "/resultados", element: <ResultsPage /> },
          { path: "/configuracoes", element: <Navigate to="/configuracoes/prompts" replace /> },
          { path: "/configuracoes/prompts", element: <PromptsPage /> },
          { path: "/admin", element: <Navigate to="/admin/dashboard" replace /> },
          { path: "/admin/dashboard", element: <AdminDashboardPage /> },
          { path: "/admin/usuarios", element: <AdminUsersPage /> },
          { path: "/admin/execucoes", element: <AdminExecutionsPage /> },
          { path: "/admin/consumos", element: <AdminConsumptionPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
