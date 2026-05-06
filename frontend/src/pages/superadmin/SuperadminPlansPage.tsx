import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { Input } from "../../components/ui/Input";
import { useToast } from "../../hooks/useToast";
import type { PlanDefinition, PlanLimits } from "../../types";
import { Pencil } from "lucide-react";

const ALL_KNOWN_FEATURES = [
  "analytics", "api_access", "custom_branding", "invoicing", "loyalty",
  "multi_branch", "multi_currency", "promotions", "receipt_design",
  "reports", "sso", "webhooks",
];

export default function SuperadminPlansPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editPlan, setEditPlan] = useState<PlanDefinition | null>(null);
  const [editName, setEditName] = useState("");
  const [editMonthly, setEditMonthly] = useState("");
  const [editAnnual, setEditAnnual] = useState("");
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [editLimits, setEditLimits] = useState<Record<string, string>>({});

  const { data: plans = [], isLoading } = useQuery<PlanDefinition[]>({
    queryKey: ["superadmin-plans"],
    queryFn: () => superadminApi.get("/api/superadmin/plans").then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: Partial<PlanDefinition> }) =>
      superadminApi.patch(`/api/superadmin/plans/${key}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
      setEditPlan(null);
      toast.success("Plan updated");
    },
    onError: () => toast.error("Failed to update plan"),
  });

  const openEdit = (plan: PlanDefinition) => {
    setEditPlan(plan);
    setEditName(plan.name);
    setEditMonthly(String(plan.monthlyPrice));
    setEditAnnual(String(plan.annualPrice));
    setEditFeatures([...plan.features]);
    setEditLimits(Object.fromEntries(Object.entries(plan.limits).map(([k, v]) => [k, String(v)])));
  };

  const toggleFeature = (f: string) => {
    setEditFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSave = () => {
    if (!editPlan) return;
    const limitsMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(editLimits)) {
      const n = parseFloat(v);
      if (!isNaN(n)) limitsMap[k] = n;
    }
    updateMutation.mutate({
      key: editPlan.key,
      payload: {
        name: editName,
        monthlyPrice: parseFloat(editMonthly) || 0,
        annualPrice: parseFloat(editAnnual) || 0,
        features: editFeatures,
        limits: limitsMap as unknown as PlanLimits,
      },
    });
  };

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Plans</h1>
        <p className="text-sm text-muted mt-0.5">View and edit subscription plans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.key} className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-ink">{plan.name}</p>
                <p className="text-sm text-muted mt-0.5">
                  ${plan.monthlyPrice}/mo &middot; ${plan.annualPrice}/yr
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2 py-0.5 ${plan.key === "enterprise" ? "bg-purple-100 text-purple-700" : plan.key === "pro" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                  {plan.key}
                </span>
                <Button variant="ghost" size="sm" onClick={() => openEdit(plan)} title="Edit plan">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted mb-2">LIMITS</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(plan.limits).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-muted capitalize">{k.replace(/_/g, " ")}: </span>
                    <span className="font-semibold text-ink">{v === -1 ? "∞" : v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted mb-2">FEATURES ({plan.features.length})</p>
              <div className="flex flex-wrap gap-1">
                {plan.features.slice(0, 8).map((f) => (
                  <span key={f} className="text-[10px] bg-page border border-stroke px-1.5 py-0.5 text-muted">{f}</span>
                ))}
                {plan.features.length > 8 && <span className="text-[10px] text-muted">+{plan.features.length - 8} more</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit modal */}
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title={`Edit Plan: ${editPlan?.key}`} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Plan name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <Input label="Monthly price ($)" type="number" min="0" step="0.01" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} />
            <Input label="Annual price ($)" type="number" min="0" step="0.01" value={editAnnual} onChange={(e) => setEditAnnual(e.target.value)} />
          </div>

          <div>
            <p className="text-xs font-semibold text-muted mb-2">LIMITS (use -1 for unlimited)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(editLimits).map(([k, v]) => (
                <div key={k}>
                  <label className="text-xs text-muted capitalize block mb-0.5">{k.replace(/_/g, " ")}</label>
                  <input
                    type="number"
                    value={v}
                    onChange={(e) => setEditLimits((prev) => ({ ...prev, [k]: e.target.value }))}
                    className="w-full border border-stroke px-2 py-1.5 text-sm bg-panel text-ink outline-none focus:border-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted mb-2">FEATURES</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_KNOWN_FEATURES.map((f) => (
                <label key={f} className={`flex items-center gap-2 p-2 border cursor-pointer text-xs ${editFeatures.includes(f) ? "border-primary-400 bg-primary-50" : "border-stroke hover:bg-hover"}`}>
                  <input
                    type="checkbox"
                    checked={editFeatures.includes(f)}
                    onChange={() => toggleFeature(f)}
                    className="w-3.5 h-3.5 accent-primary-600"
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditPlan(null)}>Cancel</Button>
            <Button onClick={handleSave} loading={updateMutation.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
