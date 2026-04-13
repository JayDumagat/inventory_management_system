import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { RequireAuth, RequireTenant } from "./components/RouteGuard";
import { ThemeProvider } from "./contexts/ThemeContext";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import OnboardingPage from "./pages/auth/OnboardingPage";
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
import StaffPage from "./pages/staff/StaffPage";
import ReportsPage from "./pages/reports/ReportsPage";
import UnitsPage from "./pages/units/UnitsPage";
import BatchesPage from "./pages/batches/BatchesPage";
import OrganizationPage from "./pages/organization/OrganizationPage";
import SuppliersPage from "./pages/suppliers/SuppliersPage";
import PurchaseOrdersPage from "./pages/purchases/PurchaseOrdersPage";
import TransactionsPage from "./pages/transactions/TransactionsPage";
import POSPage from "./pages/pos/POSPage";
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import APIPage from "./pages/apikeys/APIPage";
import LandingPage from "./pages/landing/LandingPage";
import PricingPage from "./pages/pricing/PricingPage";
import AnalyticsPage from "./pages/analytics/AnalyticsPage";
import InvoicesPage from "./pages/invoices/InvoicesPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "2px",
              fontSize: "14px",
            },
          }}
        />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Auth required but no tenant yet */}
            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<OnboardingPage />} />
            </Route>

            {/* Auth + tenant required */}
            <Route element={<RequireTenant />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/units" element={<UnitsPage />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/organization" element={<OrganizationPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/pos" element={<POSPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/api-keys" element={<APIPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
