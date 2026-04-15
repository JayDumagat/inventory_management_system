import { useQuery } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { inventoryService } from "../services/inventory";

export function useInventory() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["inventory", tid],
    queryFn: () => inventoryService.list(tid!),
    enabled: !!tid,
  });
}
