import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatCurrency, formatDate } from "../../lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Package, ShoppingCart, DollarSign, AlertTriangle } from "lucide-react";

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

export default function DashboardPage() {
  const { currentTenant } = useTenantStore();

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", currentTenant?.id],
    queryFn: () => api.get(`/api/tenants/${currentTenant!.id}/dashboard/stats`).then((r) => r.data),
    enabled: !!currentTenant,
  });

  if (isLoading) return <PageLoader />;

  const stats = [
    { label: "Total Products", value: data?.stats.totalProducts ?? 0, icon: Package, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" },
    { label: "Orders (30d)", value: data?.stats.ordersLast30Days ?? 0, icon: ShoppingCart, color: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20" },
    { label: "Revenue (30d)", value: formatCurrency(data?.stats.revenueLast30Days ?? 0), icon: DollarSign, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" },
    { label: "Low Stock", value: data?.stats.lowStockCount ?? 0, icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Welcome back to {currentTenant?.name}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Sales last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.salesByDay ?? []}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #f0f0f0)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v ?? 0))} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Low stock */}
        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data?.lowStockItems?.length ?? 0) === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No low stock items 🎉</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.lowStockItems.map((item) => (
                  <li key={item.id} className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.variant?.product?.name} — {item.variant?.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.branch?.name}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-0.5">
                      {item.quantity} left (reorder at {item.reorderPoint})
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No orders yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Order</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                    <th className="text-left px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Total</th>
                    <th className="text-right px-6 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-3 font-mono text-xs font-medium text-gray-900 dark:text-white">{order.orderNumber}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{order.customerName || "—"}</td>
                      <td className="px-6 py-3">
                        <Badge variant={statusColor[order.status] || "default"}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-400">{formatDate(order.createdAt)}</td>
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
