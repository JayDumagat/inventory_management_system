import { api } from "../api/client";
import type { DashboardStats } from "../types";

export const dashboardService = {
  getStats: (tenantId: string) =>
    api.get<DashboardStats>(`/api/tenants/${tenantId}/dashboard/stats`).then((r) => r.data),
};
