import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { SkeletonStatCard, SkeletonCard, Skeleton } from "../../components/ui/Skeleton";
import { formatCurrency, formatDate } from "../../lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Package, ShoppingCart, DollarSign, AlertTriangle, TrendingUp, Megaphone } from "lucide-react";
import sponsoredInventoryImage from "../../assets/sponsored-inventory.svg";
import sponsoredPaymentImage from "../../assets/sponsored-payment.svg";
import sponsoredAnalyticsImage from "../../assets/sponsored-analytics.svg";

interface DashboardStats {
  stats: {
    totalProducts: number;
    ordersLast30Days: number;
    revenueLast30Days: number;
    lowStockCount: number;
  };
  recentOrders: Array<{
    id: string; orderNumber: string; status: string; totalAmount: string; createdAt: string; customerName?: string;
  }>;
  salesByDay: Array<{ date: string; total: number; count: number }>;
  lowStockItems: Array<{
    id: string; quantity: number; reorderPoint: number;
    variant?: { name: string; sku: string; product?: { name: string } };
    branch?: { name: string };
  }>;
}

const statusColor: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  draft: "default", confirmed: "info", processing: "warning",
  shipped: "info", delivered: "success", cancelled: "danger", refunded: "warning",
};

const sponsoredContents = [
  {
    id: "inventory-scanner",
    title: "Smart Barcode Scanner",
    description: "Speed up receiving and stock takes with mobile-first barcode workflows.",
    image: sponsoredInventoryImage,
  },
  {
    id: "payments-terminal",
    title: "Next-Day Payouts",
    description: "Accept in-store payments with lower fees and faster payout schedules.",
    image: sponsoredPaymentImage,
  },
  {
    id: "analytics-suite",
    title: "Advanced Insights Pack",
    description: "Unlock demand forecasts and branch-level trends with AI-powered analytics.",
    image: sponsoredAnalyticsImage,
  },
];

export default function DashboardPage() {
  const { currentTenant } = useTenantStore();

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", currentTenant?.id],
    queryFn: () => api.get(`/api/tenants/${currentTenant!.id}/dashboard/stats`).then((r) => r.data),
    enabled: !!currentTenant,
  });

  if (isLoading) return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-36 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <SkeletonCard className="xl:col-span-2 h-64" />
        <SkeletonCard className="h-64" />
      </div>
      <SkeletonCard className="h-48" />
    </div>
  );

  const stats = [
    { label: "Total Products",  value: data?.stats.totalProducts ?? 0,               icon: Package,       color: "text-primary-600 bg-primary-50 border-primary-200" },
    { label: "Orders (30d)",    value: data?.stats.ordersLast30Days ?? 0,             icon: ShoppingCart,  color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Revenue (30d)",   value: formatCurrency(data?.stats.revenueLast30Days ?? 0), icon: DollarSign, color: "text-green-600 bg-green-50 border-green-200" },
    { label: "Low Stock Items", value: data?.stats.lowStockCount ?? 0,               icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-muted text-sm mt-0.5">Welcome back to {currentTenant?.name}</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted border border-stroke px-3 py-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          Last 30 days
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className={`w-10 h-10 border flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-ink">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Sales chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.salesByDay?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted text-sm">
                <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                No sales data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.salesByDay ?? []}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-500)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--accent-500)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clr)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="var(--border-clr)" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} stroke="var(--border-clr)" />
                  <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                  <Area type="monotone" dataKey="total" stroke="var(--accent-500)" strokeWidth={2} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.lowStockItems?.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-ink mb-0.5">All stocked up</p>
                <p className="text-xs text-muted">No low stock alerts at this time</p>
              </div>
            ) : (
              <ul className="divide-y divide-stroke">
                {data?.lowStockItems.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <p className="text-sm font-medium text-ink truncate">
                      {item.variant?.product?.name} — {item.variant?.name}
                    </p>
                    <p className="text-xs text-muted">{item.branch?.name}</p>
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      {item.quantity} left · reorder at {item.reorderPoint}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary-500" />
            Sponsored content
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sponsoredContents.map((item) => (
            <article key={item.id} className="border border-stroke bg-panel overflow-hidden">
              <img src={item.image} alt={item.title} className="w-full h-32 object-cover border-b border-stroke" />
              <div className="p-3 space-y-2">
                <Badge variant="info">Sponsored</Badge>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-muted">{item.description}</p>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-10 h-10 bg-primary-50 border border-primary-200 flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-5 h-5 text-primary-500" />
              </div>
              <p className="text-sm font-medium text-ink mb-0.5">No orders yet</p>
              <p className="text-xs text-muted">Orders will appear here once created</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stroke">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Order</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-stroke hover:bg-hover transition-colors">
                      <td className="px-5 py-3 font-mono text-xs font-medium text-ink">{order.orderNumber}</td>
                      <td className="px-5 py-3 text-muted">{order.customerName || "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusColor[order.status] || "default"}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-ink">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-5 py-3 text-right text-muted">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
