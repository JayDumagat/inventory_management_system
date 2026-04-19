import { useQuery } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Card } from "../../components/ui/Card";
import type { PlatformReports } from "../../types";
import { DollarSign, TrendingUp, Users, ArrowUpRight } from "lucide-react";

export default function SuperadminReportsPage() {
  const { data, isLoading } = useQuery<PlatformReports>({
    queryKey: ["superadmin-reports"],
    queryFn: () => superadminApi.get("/api/superadmin/reports").then((r) => r.data),
  });

  if (isLoading) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  const metrics = [
    {
      label: "Monthly Recurring Revenue",
      value: `$${(data?.mrr ?? 0).toLocaleString()}`,
      sub: "Based on active paid plans",
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Annual Recurring Revenue",
      value: `$${(data?.arr ?? 0).toLocaleString()}`,
      sub: "MRR × 12",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Tenants",
      value: data?.totalTenants ?? 0,
      sub: `+${data?.newTenantsLast30Days ?? 0} in last 30 days`,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "New Tenants (30d)",
      value: data?.newTenantsLast30Days ?? 0,
      sub: "Registered recently",
      icon: ArrowUpRight,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Platform Reports</h1>
        <p className="text-sm text-muted mt-0.5">Earnings and growth overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4 flex items-start gap-3">
            <div className={`${m.bg} p-2.5 flex-shrink-0`}>
              <m.icon className={`w-5 h-5 ${m.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted">{m.label}</p>
              <p className="text-xl font-bold text-ink mt-0.5">{m.value}</p>
              <p className="text-xs text-muted mt-0.5">{m.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tenants by plan */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Revenue Breakdown by Plan</h2>
        <div className="space-y-3">
          {(data?.byPlan ?? []).map((row) => {
            const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, enterprise: 99 };
            const planMrr = (PLAN_MRR[row.plan] ?? 0) * Number(row.count);
            return (
              <div key={row.plan} className="flex items-center gap-4">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 w-20 text-center ${
                    row.plan === "enterprise"
                      ? "bg-purple-100 text-purple-700"
                      : row.plan === "pro"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {row.plan}
                </span>
                <span className="text-sm text-muted">{row.count} tenants</span>
                <span className="text-sm font-semibold text-ink ml-auto">
                  ${planMrr.toLocaleString()} / mo
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Subscription statuses */}
      {(data?.byStatus ?? []).length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Subscription Health</h2>
          <div className="space-y-2">
            {(data?.byStatus ?? []).map((row) => (
              <div key={row.status} className="flex items-center justify-between">
                <span className="text-sm text-muted capitalize">{row.status}</span>
                <span className="text-sm font-semibold text-ink">{row.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
