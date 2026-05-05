import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { RequireAuth, RequireTenant } from "./components/RouteGuard";
import { SuperadminGuard } from "./components/SuperadminGuard";
import { ThemeProvider } from "./contexts/ThemeContext";
import SuperadminLayout from "./layouts/SuperadminLayout";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import OnboardingPage from "./pages/auth/OnboardingPage";
import AcceptInvitePage from "./pages/auth/AcceptInvitePage";
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
import PromotionsPage from "./pages/promotions/PromotionsPage";
import LoyaltyPage from "./pages/loyalty/LoyaltyPage";
import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import TermsPage from "./pages/legal/TermsPage";

// Superadmin pages
import SuperadminLoginPage from "./pages/superadmin/SuperadminLoginPage";
import SuperadminDashboardPage from "./pages/superadmin/SuperadminDashboardPage";
import SuperadminTenantsPage from "./pages/superadmin/SuperadminTenantsPage";
import SuperadminSubscriptionsPage from "./pages/superadmin/SuperadminSubscriptionsPage";
import SuperadminPlansPage from "./pages/superadmin/SuperadminPlansPage";
import SuperadminTicketsPage from "./pages/superadmin/SuperadminTicketsPage";
import SuperadminStaffPage from "./pages/superadmin/SuperadminStaffPage";
import SuperadminAuditLogsPage from "./pages/superadmin/SuperadminAuditLogsPage";
import SuperadminReportsPage from "./pages/superadmin/SuperadminReportsPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function SuperadminRoute({ children, page }: { children: React.ReactNode; page?: string }) {
  return (
    <SuperadminGuard requiredPage={page}>
      <SuperadminLayout>{children}</SuperadminLayout>
    </SuperadminGuard>
  );
}

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
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />

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
              <Route path="/subscription" element={<Navigate to="/organization?tab=subscriptions" replace />} />
              <Route path="/promotions" element={<PromotionsPage />} />
              <Route path="/loyalty" element={<LoyaltyPage />} />
            </Route>

            {/* Superadmin panel */}
            <Route path="/superadmin/login" element={<SuperadminLoginPage />} />
            <Route
              path="/superadmin/dashboard"
              element={
                <SuperadminRoute page="dashboard">
                  <SuperadminDashboardPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/tenants"
              element={
                <SuperadminRoute page="tenants">
                  <SuperadminTenantsPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/subscriptions"
              element={
                <SuperadminRoute page="subscriptions">
                  <SuperadminSubscriptionsPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/plans"
              element={
                <SuperadminRoute page="plans">
                  <SuperadminPlansPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/tickets"
              element={
                <SuperadminRoute page="tickets">
                  <SuperadminTicketsPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/staff"
              element={
                <SuperadminRoute>
                  <SuperadminStaffPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/audit-logs"
              element={
                <SuperadminRoute page="audit-logs">
                  <SuperadminAuditLogsPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin/reports"
              element={
                <SuperadminRoute page="reports">
                  <SuperadminReportsPage />
                </SuperadminRoute>
              }
            />
            <Route
              path="/superadmin"
              element={<Navigate to="/superadmin/dashboard" replace />}
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
