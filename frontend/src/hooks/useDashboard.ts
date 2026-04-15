import { useQuery } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { dashboardService } from "../services/dashboard";

export function useDashboard() {
  const { currentTenant } = useTenantStore();
  return useQuery({
    queryKey: ["dashboard", currentTenant?.id],
    queryFn: () => dashboardService.getStats(currentTenant!.id),
    enabled: !!currentTenant,
  });
}
