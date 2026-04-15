import { useQuery } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { ordersService } from "../services/orders";

export function useOrders() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["orders", tid],
    queryFn: () => ordersService.list(tid!),
    enabled: !!tid,
  });
}
