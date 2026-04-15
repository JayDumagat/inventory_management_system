import { useQuery } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { invoicesService } from "../services/invoices";

export function useInvoices() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["invoices", tid],
    queryFn: () => invoicesService.list(tid!),
    enabled: !!tid,
  });
}
