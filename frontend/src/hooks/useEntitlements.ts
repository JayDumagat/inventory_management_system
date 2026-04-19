import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useTenantStore } from "../stores/tenantStore";
import type { TenantSubscription, SubscriptionUsage, PlanDefinition, SubscriptionAddon } from "../types";

interface SubscriptionData {
  subscription: TenantSubscription;
  plan: PlanDefinition;
  addons: SubscriptionAddon[];
  usage: SubscriptionUsage;
}

export function useSubscription() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;

  return useQuery<SubscriptionData>({
    queryKey: ["subscription", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/subscription`).then((r) => r.data),
    enabled: !!tid,
    staleTime: 60_000,
  });
}

export function useHasFeature(feature: string): boolean {
  const { data } = useSubscription();
  if (!data) return true; // optimistic: allow if not yet loaded
  return data.plan.features.includes(feature);
}

export function useIsAtLimit(resource: keyof SubscriptionUsage): boolean {
  const { data } = useSubscription();
  if (!data) return false;
  const metric = data.usage[resource];
  if (!metric) return false;
  if (metric.limit === -1) return false; // unlimited
  return metric.current >= metric.limit;
}
