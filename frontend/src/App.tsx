import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequireAuth, RequireTenant } from "./components/RouteGuard";
import { ThemeProvider } from "./contexts/ThemeContext";

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
import CustomersPage from "./pages/customers/CustomersPage";
import ProfilePage from "./pages/profile/ProfilePage";
import SettingsPage from "./pages/settings/SettingsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

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
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
