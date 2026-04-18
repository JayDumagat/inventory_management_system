import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import AppLayout from "../layouts/AppLayout";

// Pages staff always have access to regardless of allowedPages
const ALWAYS_ALLOWED_PATHS = ["/dashboard", "/profile", "/settings"];

export function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireTenant() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!currentTenant) return <Navigate to="/setup" replace />;

  // Enforce page-level access for staff with explicit page restrictions
  const myRole = currentTenant.role;
  const allowedPages = currentTenant.allowedPages;
  if (myRole === "staff" && allowedPages && allowedPages.length > 0) {
    const isAllowed =
      ALWAYS_ALLOWED_PATHS.includes(location.pathname) ||
      allowedPages.includes(location.pathname);
    if (!isAllowed) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <AppLayout><Outlet /></AppLayout>;
}
