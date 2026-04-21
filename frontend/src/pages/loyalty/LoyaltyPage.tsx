import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { SkeletonTable } from "../../components/ui/Skeleton";
import { useToast } from "../../hooks/useToast";
import { Star, Settings, Users, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import type { LoyaltyConfig, CustomerLoyalty } from "../../types";
import { useSubscription } from "../../hooks/useEntitlements";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TopCustomer {
  id: string;
  name: string;
  email?: string;
  loyaltyPoints: number;
}

// ─── Config form ──────────────────────────────────────────────────────────────
const configSchema = z.object({
  isEnabled: z.boolean(),
  programName: z.string().min(1).max(100),
  pointsLabel: z.string().min(1).max(50),
  pointsPerDollar: z.number().min(0.01),
  pointsPerRedemptionDollar: z.number().min(1),
  minimumPointsToRedeem: z.number().int().min(1),
  maximumRedeemPercent: z.number().int().min(1).max(100),
  pointsExpireDays: z.number().int().min(1).nullable().optional(),
});
type ConfigForm = z.infer<typeof configSchema>;

// ─── Adjust form ──────────────────────────────────────────────────────────────
const adjustSchema = z.object({
  points: z.number().int().min(-100000).max(100000),
  notes: z.string().max(500).optional(),
});
type AdjustForm = z.infer<typeof adjustSchema>;

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoyaltyPage() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;
  const role = currentTenant?.role;
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = ["owner", "admin", "manager"].includes(role ?? "");
  const { data: subscriptionData } = useSubscription();
  const hasLoyaltyFeature = subscriptionData ? subscriptionData.plan.features.includes("loyalty") : true;

  const [configOpen, setConfigOpen] = useState(false);
  const [adjustCustomer, setAdjustCustomer] = useState<TopCustomer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<TopCustomer | null>(null);

  const configForm = useForm<ConfigForm>({ resolver: zodResolver(configSchema) });
  const adjustForm = useForm<AdjustForm>({ resolver: zodResolver(adjustSchema) });

  const { data: config, isLoading: configLoading } = useQuery<LoyaltyConfig>({
    queryKey: ["loyalty-config", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/loyalty/config`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: topCustomers = [], isLoading: topLoading } = useQuery<TopCustomer[]>({
    queryKey: ["loyalty-top", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/loyalty/top-customers`).then((r) => r.data),
    enabled: !!tid && canManage,
  });

  const { data: ledger } = useQuery<CustomerLoyalty>({
    queryKey: ["loyalty-ledger", tid, ledgerCustomer?.id],
    queryFn: () => api.get(`/api/tenants/${tid}/loyalty/customers/${ledgerCustomer!.id}`).then((r) => r.data),
    enabled: !!ledgerCustomer,
  });

  const saveConfig = useMutation({
    mutationFn: (data: ConfigForm) =>
      api.patch(`/api/tenants/${tid}/loyalty/config`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-config", tid] });
      setConfigOpen(false);
      toast.success("Loyalty program updated");
    },
    onError: () => toast.error("Failed to update loyalty config"),
  });

  const adjustPoints = useMutation({
    mutationFn: (data: AdjustForm & { customerId: string }) =>
      api.post(`/api/tenants/${tid}/loyalty/adjust`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty-top", tid] });
      if (ledgerCustomer) qc.invalidateQueries({ queryKey: ["loyalty-ledger", tid, ledgerCustomer.id] });
      setAdjustCustomer(null);
      adjustForm.reset();
      toast.success("Points adjusted");
    },
    onError: () => toast.error("Failed to adjust points"),
  });

  function openConfig() {
    if (config) {
      configForm.reset({
        isEnabled: config.isEnabled,
        programName: config.programName,
        pointsLabel: config.pointsLabel,
        pointsPerDollar: Number(config.pointsPerDollar),
        pointsPerRedemptionDollar: Number(config.pointsPerRedemptionDollar),
        minimumPointsToRedeem: config.minimumPointsToRedeem,
        maximumRedeemPercent: config.maximumRedeemPercent,
        pointsExpireDays: config.pointsExpireDays ?? null,
      });
    }
    setConfigOpen(true);
  }

  if (!canManage) {
    return (
      <div className="p-6 text-center text-muted">
        <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>You don't have permission to manage the loyalty program.</p>
      </div>
    );
  }

  if (!hasLoyaltyFeature) {
    return (
      <div className="p-6 text-center text-muted">
        <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>Your current plan does not include the loyalty program.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-xl font-semibold text-ink">Loyalty Program</h1>
            <p className="text-sm text-muted">Reward your customers for every purchase</p>
          </div>
        </div>
        <Button variant="outline" onClick={openConfig}>
          <Settings className="w-4 h-4 mr-1.5" /> Configure
        </Button>
      </div>

      {/* Status card */}
      {configLoading ? (
        <SkeletonTable />
      ) : config ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {config.programName}
              <Badge
                variant={config.isEnabled ? "success" : "default"}
                className="ml-2"
              >
                {config.isEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="border border-stroke p-3 text-center">
                <p className="text-xl font-bold text-ink">{config.pointsPerDollar}</p>
                <p className="text-xs text-muted">{config.pointsLabel} / $1 spent</p>
              </div>
              <div className="border border-stroke p-3 text-center">
                <p className="text-xl font-bold text-ink">{config.pointsPerRedemptionDollar}</p>
                <p className="text-xs text-muted">{config.pointsLabel} per $1 off</p>
              </div>
              <div className="border border-stroke p-3 text-center">
                <p className="text-xl font-bold text-ink">{config.minimumPointsToRedeem}</p>
                <p className="text-xs text-muted">Min. to redeem</p>
              </div>
              <div className="border border-stroke p-3 text-center">
                <p className="text-xl font-bold text-ink">{config.maximumRedeemPercent}%</p>
                <p className="text-xs text-muted">Max. of order covered</p>
              </div>
            </div>
            {config.pointsExpireDays && (
              <p className="text-xs text-muted mt-3">
                Points expire after {config.pointsExpireDays} days of inactivity.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Top customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top Customers by Points
          </CardTitle>
        </CardHeader>
        {topLoading ? (
          <CardContent><SkeletonTable /></CardContent>
        ) : topCustomers.length === 0 ? (
          <CardContent>
            <p className="text-sm text-muted py-4 text-center">No customer loyalty data yet.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted">Email</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted">Points</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={c.id} className="border-b border-stroke hover:bg-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted w-5 shrink-0">#{i + 1}</span>
                        <span className="font-medium text-ink">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-amber-600">{c.loyaltyPoints.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="View ledger"
                          onClick={() => setLedgerCustomer(c)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Adjust points"
                          onClick={() => { adjustForm.reset(); setAdjustCustomer(c); }}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Config modal */}
      <Modal open={configOpen} onClose={() => setConfigOpen(false)} title="Configure Loyalty Program" size="md">
        <form onSubmit={configForm.handleSubmit((d) => saveConfig.mutate(d))} className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...configForm.register("isEnabled")} />
            <span className="font-medium">Enable loyalty program</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Program name" {...configForm.register("programName")} />
            </div>
            <Input label="Points label (e.g. points, stars)" {...configForm.register("pointsLabel")} />
            <Input
              label="Points earned per $1 spent"
              type="number"
              step="0.01"
              error={configForm.formState.errors.pointsPerDollar?.message}
              {...configForm.register("pointsPerDollar", { valueAsNumber: true })}
            />
            <Input
              label="Points needed per $1 off"
              type="number"
              error={configForm.formState.errors.pointsPerRedemptionDollar?.message}
              {...configForm.register("pointsPerRedemptionDollar", { valueAsNumber: true })}
            />
            <Input
              label="Minimum points to redeem"
              type="number"
              error={configForm.formState.errors.minimumPointsToRedeem?.message}
              {...configForm.register("minimumPointsToRedeem", { valueAsNumber: true })}
            />
            <Input
              label="Max % of order covered"
              type="number"
              min={1}
              max={100}
              error={configForm.formState.errors.maximumRedeemPercent?.message}
              {...configForm.register("maximumRedeemPercent", { valueAsNumber: true })}
            />
            <Input
              label="Points expire after (days)"
              type="number"
              helperText="Leave blank for never"
              {...configForm.register("pointsExpireDays", { valueAsNumber: true })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-stroke">
            <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saveConfig.isPending}>
              {saveConfig.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Adjust modal */}
      <Modal
        open={!!adjustCustomer}
        onClose={() => setAdjustCustomer(null)}
        title={`Adjust Points — ${adjustCustomer?.name}`}
        size="sm"
      >
        <form
          onSubmit={adjustForm.handleSubmit((d) =>
            adjustPoints.mutate({ ...d, customerId: adjustCustomer!.id })
          )}
          className="space-y-4"
        >
          <div className="flex items-center gap-4 justify-center text-center">
            <button
              type="button"
              className="flex flex-col items-center p-3 border border-stroke hover:bg-hover"
              onClick={() => {
                const cur = adjustForm.getValues("points") ?? 0;
                adjustForm.setValue("points", Math.abs(cur));
              }}
            >
              <ArrowUpCircle className="w-6 h-6 text-green-500 mb-1" />
              <span className="text-xs">Add points</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center p-3 border border-stroke hover:bg-hover"
              onClick={() => {
                const cur = adjustForm.getValues("points") ?? 0;
                adjustForm.setValue("points", -Math.abs(cur));
              }}
            >
              <ArrowDownCircle className="w-6 h-6 text-red-500 mb-1" />
              <span className="text-xs">Remove points</span>
            </button>
          </div>
          <p className="text-xs text-muted text-center">
            Current balance: <strong>{adjustCustomer?.loyaltyPoints ?? 0}</strong> points
          </p>
          <Input
            label="Points (positive = add, negative = remove)"
            type="number"
            error={adjustForm.formState.errors.points?.message}
            {...adjustForm.register("points", { valueAsNumber: true })}
          />
          <Input label="Notes (optional)" {...adjustForm.register("notes")} />
          <div className="flex justify-end gap-2 pt-2 border-t border-stroke">
            <Button type="button" variant="outline" onClick={() => setAdjustCustomer(null)}>Cancel</Button>
            <Button type="submit" disabled={adjustPoints.isPending}>
              {adjustPoints.isPending ? "Saving..." : "Apply"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Ledger modal */}
      <Modal
        open={!!ledgerCustomer}
        onClose={() => setLedgerCustomer(null)}
        title={`Points History — ${ledgerCustomer?.name}`}
        size="lg"
      >
        {ledger ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-sm font-medium text-ink">
              Balance: <span className="text-amber-600 font-bold">{ledger.balance.toLocaleString()}</span> points
            </p>
            {ledger.ledger.length === 0 ? (
              <p className="text-sm text-muted">No transactions yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-stroke">
                    <th className="text-left py-2 px-2 text-muted">Type</th>
                    <th className="text-right py-2 px-2 text-muted">Points</th>
                    <th className="text-right py-2 px-2 text-muted">Balance</th>
                    <th className="text-left py-2 px-2 text-muted">Note</th>
                    <th className="text-left py-2 px-2 text-muted">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.ledger.map((e) => (
                    <tr key={e.id} className="border-b border-stroke">
                      <td className="py-2 px-2">
                        <Badge
                          variant={
                            e.type === "earn" ? "success" :
                            e.type === "redeem" ? "info" :
                            e.type === "expire" ? "warning" : "default"
                          }
                        >
                          {e.type}
                        </Badge>
                      </td>
                      <td className={`py-2 px-2 text-right font-medium ${e.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {e.points >= 0 ? "+" : ""}{e.points}
                      </td>
                      <td className="py-2 px-2 text-right text-muted">{e.balanceAfter}</td>
                      <td className="py-2 px-2 text-muted">{e.notes ?? "—"}</td>
                      <td className="py-2 px-2 text-muted">{new Date(e.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <SkeletonTable />
        )}
      </Modal>
    </div>
  );
}
