import { useQuery } from "@tanstack/react-query";
import { superadminApi } from "../../api/superadminClient";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import type { PlatformReports } from "../../types";
import { Users, TrendingUp, DollarSign, TicketCheck } from "lucide-react";

export default function SuperadminDashboardPage() {
  const { data, isLoading } = useQuery<PlatformReports>({
    queryKey: ["superadmin-reports"],
    queryFn: () => superadminApi.get("/api/superadmin/reports").then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Tenants",
      value: data?.totalTenants ?? 0,
      sub: `+${data?.newTenantsLast30Days ?? 0} last 30 days`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "MRR",
      value: `$${(data?.mrr ?? 0).toLocaleString()}`,
      sub: `ARR $${(data?.arr ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Active Plans",
      value: (data?.byPlan ?? []).find((p) => p.plan !== "free")?.count ?? 0,
      sub: `${data?.byPlan?.find((p) => p.plan === "free")?.count ?? 0} on Free`,
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Open Tickets",
      value: "—",
      sub: "Check tickets page",
      icon: TicketCheck,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink">Platform Overview</h1>
        <p className="text-sm text-muted mt-0.5">Summary of your platform activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4 flex items-start gap-3">
            <div className={`${s.bg} p-2.5 flex-shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted">{s.label}</p>
              <p className="text-xl font-bold text-ink mt-0.5">{s.value}</p>
              <p className="text-xs text-muted mt-0.5">{s.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Plan distribution */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Tenants by Plan</h2>
        <div className="flex flex-wrap gap-4">
          {(data?.byPlan ?? []).map((row) => (
            <div key={row.plan} className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-0.5 ${
                  row.plan === "enterprise"
                    ? "bg-purple-100 text-purple-700"
                    : row.plan === "pro"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {row.plan}
              </span>
              <span className="text-sm font-semibold text-ink">{row.count}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Subscription statuses */}
      {(data?.byStatus ?? []).length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink mb-4">Subscription Statuses</h2>
          <div className="flex flex-wrap gap-4">
            {(data?.byStatus ?? []).map((row) => (
              <div key={row.status} className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted capitalize">{row.status}</span>
                <span className="text-sm font-semibold text-ink">{row.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
