import { Navigate, useLocation } from "react-router-dom";
import { useSuperadminStore } from "../stores/superadminStore";

interface SuperadminGuardProps {
  children: React.ReactNode;
  requiredPage?: string;
}

export function SuperadminGuard({ children, requiredPage }: SuperadminGuardProps) {
  const { isAuthenticated, superadmin } = useSuperadminStore();
  const location = useLocation();

  if (!isAuthenticated || !superadmin) {
    return <Navigate to="/superadmin/login" state={{ from: location }} replace />;
  }

  if (requiredPage && superadmin.role !== "owner") {
    const allowed = superadmin.allowedPages ?? [];
    if (!allowed.includes(requiredPage)) {
      return <Navigate to="/superadmin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
