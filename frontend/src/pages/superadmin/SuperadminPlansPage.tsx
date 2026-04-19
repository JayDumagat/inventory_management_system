import { useQuery } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Card } from "../../components/ui/Card";
import type { PlanDefinition } from "../../types";

export default function SuperadminPlansPage() {
  const { data: plans = [], isLoading } = useQuery<PlanDefinition[]>({
    queryKey: ["superadmin-plans"],
    queryFn: () => superadminApi.get("/api/superadmin/plans").then((r) => r.data),
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">Plans</h1>
        <p className="text-sm text-muted mt-0.5">View available subscription plans and their features</p>
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
              <span
                className={`text-xs font-semibold px-2 py-0.5 ${
                  plan.key === "enterprise"
                    ? "bg-purple-100 text-purple-700"
                    : plan.key === "pro"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {plan.key}
              </span>
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
                  <span key={f} className="text-[10px] bg-page border border-stroke px-1.5 py-0.5 text-muted">
                    {f}
                  </span>
                ))}
                {plan.features.length > 8 && (
                  <span className="text-[10px] text-muted">+{plan.features.length - 8} more</span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
