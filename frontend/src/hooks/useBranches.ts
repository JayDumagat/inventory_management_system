import { useQuery } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { branchesService } from "../services/branches";

export function useBranches() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["branches", tid],
    queryFn: () => branchesService.list(tid!),
    enabled: !!tid,
  });
}
