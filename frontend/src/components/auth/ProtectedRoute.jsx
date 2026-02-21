import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { clearAccessToken, isAuthenticated } from "../../lib/session";

export default function ProtectedRoute() {
  const location = useLocation();
  const hasToken = isAuthenticated();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    if (!hasToken) {
      setStatus("unauthenticated");
      return undefined;
    }

    api
      .me()
      .then(() => {
        if (!cancelled) setStatus("ok");
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          clearAccessToken();
        }
        if (!cancelled) setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (status === "loading") {
    return <div className="min-h-screen bg-slate-100" />;
  }

  if (status !== "ok") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
