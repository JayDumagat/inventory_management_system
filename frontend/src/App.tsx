import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequireAuth, RequireTenant } from "./components/RouteGuard";
import { useThemeStore } from "./stores/themeStore";
import { useEffect } from "react";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import SetupPage from "./pages/auth/SetupPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ProductsPage from "./pages/products/ProductsPage";
import CategoriesPage from "./pages/categories/CategoriesPage";
import InventoryPage from "./pages/inventory/InventoryPage";
import OrdersPage from "./pages/orders/OrdersPage";
import AuditPage from "./pages/audit/AuditPage";
import BranchesPage from "./pages/branches/BranchesPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { mode, accent } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;

    // Remove previous theme classes
    root.classList.remove(
      "theme-blue", "theme-violet", "theme-emerald", "theme-rose", "theme-amber", "theme-teal"
    );
    root.classList.add(`theme-${accent}`);

    // Apply dark mode
    const applyDark = (dark: boolean) => {
      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
    };

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      applyDark(mode === "dark");
    }
  }, [mode, accent]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Auth required but no tenant yet */}
            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<SetupPage />} />
            </Route>

            {/* Auth + tenant required */}
            <Route element={<RequireTenant />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/branches" element={<BranchesPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

