import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useTenantStore } from "../stores/tenantStore";
import AppLayout from "../layouts/AppLayout";

export function RequireAuth() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireTenant() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentTenant = useTenantStore((s) => s.currentTenant);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!currentTenant) return <Navigate to="/setup" replace />;
  return <AppLayout><Outlet /></AppLayout>;
}
