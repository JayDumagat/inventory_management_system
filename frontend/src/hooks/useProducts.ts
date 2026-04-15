import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantStore } from "../stores/tenantStore";
import { productsService, categoriesService, unitsService } from "../services/products";

export function useProducts() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["products", tid],
    queryFn: () => productsService.list(tid!),
    enabled: !!tid,
  });
}

export function useCategories() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["categories", tid],
    queryFn: () => categoriesService.list(tid!),
    enabled: !!tid,
  });
}

export function useUnits() {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  return useQuery({
    queryKey: ["units", tid],
    queryFn: () => unitsService.list(tid!),
    enabled: !!tid,
  });
}

export function useSaveProduct(onSuccess?: () => void) {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? productsService.update(tid!, id, data) : productsService.create(tid!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      onSuccess?.();
    },
  });
}

export function useDeleteProduct(onSuccess?: () => void) {
  const tid = useTenantStore((s) => s.currentTenant?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsService.delete(tid!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      onSuccess?.();
    },
  });
}
