import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { useAuthStore } from "../../stores/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { Zap, CheckCircle, TrendingUp, AlertTriangle, Plus, Trash2, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import type {
  TenantSubscription, PlanDefinition, SubscriptionAddon,
  SubscriptionUsage, SubscriptionHistoryEntry,
} from "../../types";

interface SubscriptionData {
  subscription: TenantSubscription;
  plan: PlanDefinition;
  addons: SubscriptionAddon[];
  usage: SubscriptionUsage;
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-100 text-gray-700 border-gray-300",
  pro: "bg-primary-50 text-primary-700 border-primary-300",
  enterprise: "bg-purple-50 text-purple-700 border-purple-300",
};

const AVAILABLE_ADDONS = [
  { key: "extra_branches_1", label: "+1 Branch", price: "$5/mo" },
  { key: "extra_branches_5", label: "+5 Branches", price: "$20/mo" },
  { key: "extra_products_500", label: "+500 Products", price: "$10/mo" },
  { key: "extra_invoices_100", label: "+100 Invoices/mo", price: "$8/mo" },
  { key: "extra_api_keys_5", label: "+5 API Keys", price: "$5/mo" },
];

function UsageBar({ current, limit, label }: { current: number; limit: number; label: string }) {
  const pct = limit === -1 ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const isUnlimited = limit === -1;
  const isNearLimit = !isUnlimited && pct >= 80;
  const isAtLimit = !isUnlimited && pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("font-medium", isAtLimit ? "text-red-600" : isNearLimit ? "text-amber-600" : "text-ink")}>
          {current} / {isUnlimited ? "∞" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 bg-stroke rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-primary-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const { currentTenant } = useTenantStore();
  const { user } = useAuthStore();
  const tid = currentTenant?.id;
  const role = currentTenant?.role;
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = ["owner", "admin"].includes(role ?? "");

  const [upgradeTarget, setUpgradeTarget] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ["subscription", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/subscription`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: plans = [] } = useQuery<PlanDefinition[]>({
    queryKey: ["plans"],
    queryFn: () => api.get("/api/subscription/plans").then((r) => r.data),
  });

  const { data: history = [] } = useQuery<SubscriptionHistoryEntry[]>({
    queryKey: ["subscription-history", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/subscription/history`).then((r) => r.data),
    enabled: !!tid && canManage,
  });

  const changePlan = useMutation({
    mutationFn: (planKey: string) =>
      api.patch(`/api/tenants/${tid}/subscription`, { planKey }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", tid] });
      qc.invalidateQueries({ queryKey: ["subscription-history", tid] });
      setUpgradeTarget(null);
      toast.success("Plan updated successfully");
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err.response?.data?.error ?? "Failed to change plan"),
  });

  const addAddon = useMutation({
    mutationFn: (addonKey: string) =>
      api.post(`/api/tenants/${tid}/subscription/addons`, { addonKey }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", tid] });
      toast.success("Add-on activated");
    },
    onError: () => toast.error("Failed to activate add-on"),
  });

  const removeAddon = useMutation({
    mutationFn: (addonKey: string) =>
      api.delete(`/api/tenants/${tid}/subscription/addons`, { data: { addonKey } }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", tid] });
      toast.success("Add-on removed");
    },
    onError: () => toast.error("Failed to remove add-on"),
  });

  if (isLoading) return <SkeletonTable />;
  if (!data) return null;

  const { subscription, plan, addons, usage } = data;
  const currentPlanKey = subscription.planKey;

  // suppress unused variable warning – user object needed for future personalization
  void user;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-primary-500" />
        <div>
          <h1 className="text-xl font-semibold text-ink">Subscription</h1>
          <p className="text-sm text-muted">Manage your plan, limits, and add-ons</p>
        </div>
      </div>

      {/* Current plan summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className={cn("px-3 py-1 text-sm font-semibold border rounded-full", PLAN_COLORS[currentPlanKey] ?? PLAN_COLORS.free)}>
                {plan.name}
              </span>
              <Badge variant={subscription.status === "active" ? "success" : "warning"}>
                {subscription.status}
              </Badge>
              {subscription.cancelAtPeriodEnd && (
                <Badge variant="warning">
                  <Clock className="w-3 h-3 mr-1" />
                  Cancels at period end
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted">
              {plan.monthlyPrice === 0 ? "Free forever" : `$${plan.monthlyPrice}/mo · $${plan.annualPrice}/yr`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <UsageBar current={usage.branches.current} limit={usage.branches.limit} label="Branches" />
            <UsageBar current={usage.products.current} limit={usage.products.limit} label="Products" />
            <UsageBar current={usage.api_keys.current} limit={usage.api_keys.limit} label="API Keys" />
            <UsageBar current={usage.invoices_per_month.current} limit={usage.invoices_per_month.limit} label="Invoices this month" />
          </div>
        </CardContent>
      </Card>

      {/* Available plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Available Plans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = p.key === currentPlanKey;
              const isTarget = upgradeTarget === p.key;
              return (
                <div
                  key={p.key}
                  className={cn(
                    "border p-4 space-y-3 transition-colors",
                    isCurrent ? "border-primary-400 bg-primary-50" : "border-stroke bg-panel"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink">{p.name}</h3>
                    {isCurrent && <CheckCircle className="w-4 h-4 text-primary-500" />}
                  </div>
                  <div className="text-2xl font-bold text-ink">
                    {p.monthlyPrice === 0 ? "Free" : `$${p.monthlyPrice}`}
                    {p.monthlyPrice > 0 && <span className="text-sm font-normal text-muted">/mo</span>}
                  </div>
                  <ul className="text-xs text-muted space-y-1">
                    <li>Branches: {p.limits.branches === -1 ? "Unlimited" : p.limits.branches}</li>
                    <li>Products: {p.limits.products === -1 ? "Unlimited" : p.limits.products}</li>
                    <li>API Keys: {p.limits.api_keys === -1 ? "Unlimited" : p.limits.api_keys === 0 ? "None" : p.limits.api_keys}</li>
                    <li>Invoices/mo: {p.limits.invoices_per_month === -1 ? "Unlimited" : p.limits.invoices_per_month === 0 ? "None" : p.limits.invoices_per_month}</li>
                  </ul>
                  {!isCurrent && canManage && (
                    <div className="space-y-2">
                      {isTarget ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => changePlan.mutate(p.key)}
                            disabled={changePlan.isPending}
                          >
                            {changePlan.isPending ? "Changing..." : "Confirm"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setUpgradeTarget(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setUpgradeTarget(p.key)}>
                          Switch to {p.name}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add-ons */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Active add-ons */}
              {addons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted mb-2">Active Add-ons</p>
                  <div className="space-y-2">
                    {addons.map((addon) => (
                      <div key={addon.id} className="flex items-center justify-between border border-stroke p-3">
                        <div>
                          <span className="text-sm font-medium text-ink">{addon.addonKey}</span>
                          <span className="ml-2 text-xs text-muted">×{addon.quantity}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeAddon.mutate(addon.addonKey)}
                          disabled={removeAddon.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available add-ons */}
              <div>
                <p className="text-xs font-medium text-muted mb-2">Available Add-ons</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_ADDONS.map((a) => (
                    <div key={a.key} className="flex items-center justify-between border border-stroke p-3">
                      <div>
                        <p className="text-sm font-medium text-ink">{a.label}</p>
                        <p className="text-xs text-muted">{a.price}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addAddon.mutate(a.key)}
                        disabled={addAddon.isPending}
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Downgrade warning */}
      {upgradeTarget && plans.find(p => p.key === upgradeTarget)?.monthlyPrice === 0 && (
        <div className="flex gap-2 items-start p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Downgrading to Free may exceed your plan limits. Review your branches and products before confirming.</p>
        </div>
      )}

      {/* History */}
      {canManage && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm border-b border-stroke last:border-0 pb-2 last:pb-0">
                  <div>
                    <span className="text-ink font-medium">{h.fromPlan} → {h.toPlan}</span>
                    {h.reason && <p className="text-xs text-muted">{h.reason}</p>}
                  </div>
                  <span className="text-xs text-muted">{new Date(h.effectiveAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
