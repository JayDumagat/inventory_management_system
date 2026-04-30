import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { useFormatCurrency } from "../../lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, ShoppingCart, DollarSign, Package, AlertTriangle, ArrowUpRight } from "lucide-react";

interface SalesReport {
  from: string;
  to: string;
  byDay: { date: string; orderCount: number; revenue: string }[];
  summary: { totalOrders: number; totalRevenue: string; avgOrderValue: string };
}

interface InventoryReport {
  summary: { totalUnits: number; totalValue: string; lowStockCount: number };
  byBranch: { branchId: string; branchName: string; totalUnits: number; stockValue: string }[];
  byCategory: { categoryId: string; categoryName: string; totalUnits: number; stockValue: string }[];
  lowStock: { inventoryId: string; quantity: number; reorderPoint: number; variantName: string; sku: string; productName: string; branchName: string }[];
}

interface ProductsReport {
  from: string;
  to: string;
  products: { productId: string; productName: string; variantName: string; sku: string; totalQty: number; totalRevenue: string }[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function formatDateParam(d: Date) {
  return d.toISOString().split("T")[0];
}

function toTooltipNumber(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue = Number(rawValue ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function AnalyticsPage() {
  const { currentTenant } = useTenantStore();
  const formatCurrency = useFormatCurrency();
  const tid = currentTenant?.id;

  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = formatDateParam(thirtyAgo);
  const to = formatDateParam(today);

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ["reports-sales-analytics", tid, from, to],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/sales?from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: inventoryData, isLoading: invLoading } = useQuery<InventoryReport>({
    queryKey: ["reports-inventory-analytics", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/inventory`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: productsData, isLoading: prodLoading } = useQuery<ProductsReport>({
    queryKey: ["reports-products-analytics", tid, from, to],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/products?from=${from}&to=${to}`).then((r) => r.data),
    enabled: !!tid,
  });

  if (salesLoading || invLoading || prodLoading) return (
  <div className="space-y-4">
    <Skeleton className="h-7 w-40" />
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  </div>
);

  const revenueChartData = (salesData?.byDay ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: parseFloat(d.revenue),
    orders: d.orderCount,
  }));

  const topProducts = (productsData?.products ?? []).slice(0, 8).map((p) => ({
    name: p.productName.length > 15 ? p.productName.slice(0, 15) + "…" : p.productName,
    revenue: parseFloat(p.totalRevenue),
    qty: p.totalQty,
  }));

  const inventoryByCategory = (inventoryData?.byCategory ?? []).slice(0, 6).map((c) => ({
    name: c.categoryName || "Uncategorized",
    value: c.totalUnits,
  }));

  const kpis = [
    {
      label: "Total Revenue (30d)",
      value: formatCurrency(salesData?.summary.totalRevenue ?? 0),
      icon: DollarSign,
      color: "text-green-600 bg-green-50 border-green-200",
      sub: `${salesData?.summary.totalOrders ?? 0} orders`,
    },
    {
      label: "Avg Order Value",
      value: formatCurrency(salesData?.summary.avgOrderValue ?? 0),
      icon: TrendingUp,
      color: "text-blue-600 bg-blue-50 border-blue-200",
      sub: "Per order",
    },
    {
      label: "Total Stock Units",
      value: (inventoryData?.summary.totalUnits ?? 0).toLocaleString(),
      icon: Package,
      color: "text-violet-600 bg-violet-50 border-violet-200",
      sub: formatCurrency(inventoryData?.summary.totalValue ?? 0) + " value",
    },
    {
      label: "Low Stock Alerts",
      value: (inventoryData?.summary.lowStockCount ?? 0).toLocaleString(),
      icon: AlertTriangle,
      color: "text-amber-600 bg-amber-50 border-amber-200",
      sub: "Items below reorder point",
    },
    {
      label: "Orders (30d)",
      value: (salesData?.summary.totalOrders ?? 0).toLocaleString(),
      icon: ShoppingCart,
      color: "text-primary-600 bg-primary-50 border-primary-200",
      sub: "Last 30 days",
    },
    {
      label: "Top Products",
      value: (productsData?.products.length ?? 0).toLocaleString(),
      icon: ArrowUpRight,
      color: "text-teal-600 bg-teal-50 border-teal-200",
      sub: "Active selling",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-muted text-sm mt-1">Last 30 days performance overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted mb-1">{kpi.label}</p>
                  <p className="text-xl font-bold text-ink">{kpi.value}</p>
                  <p className="text-xs text-muted mt-1">{kpi.sub}</p>
                </div>
                <div className={`w-9 h-9 border flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueChartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueChartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value) => {
                    const numericValue = toTooltipNumber(value);
                    return `$${numericValue.toFixed(2)}`;
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted">No product data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = toTooltipNumber(value);
                      return `$${numericValue.toFixed(2)}`;
                    }}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Inventory by Category Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Stock by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryByCategory.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted">No inventory data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={inventoryByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {inventoryByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const numericValue = toTooltipNumber(value);
                      return numericValue.toLocaleString();
                    }}
                  />
                  <Legend formatter={(v) => <span className="text-xs text-ink">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Table */}
      {(inventoryData?.lowStock.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Low Stock Items ({inventoryData!.lowStock.length})
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stroke text-left">
                  <th className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Product</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">SKU</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Branch</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider">Reorder At</th>
                </tr>
              </thead>
              <tbody>
                {inventoryData!.lowStock.slice(0, 10).map((item) => (
                  <tr key={item.inventoryId} className="border-b border-stroke hover:bg-hover transition-colors">
                    <td className="px-4 py-2 text-ink font-medium">{item.productName} — {item.variantName}</td>
                    <td className="px-4 py-2 text-muted font-mono text-xs">{item.sku}</td>
                    <td className="px-4 py-2 text-muted">{item.branchName}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 text-xs font-semibold bg-red-50 text-red-600 border border-red-200">
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted">{item.reorderPoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stock by Branch */}
      {(inventoryData?.byBranch.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stock by Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventoryData!.byBranch.map((b) => (
                <div key={b.branchId} className="p-3 border border-stroke">
                  <p className="text-sm font-medium text-ink mb-1">{b.branchName}</p>
                  <p className="text-xl font-bold text-ink">{b.totalUnits.toLocaleString()} <span className="text-sm font-normal text-muted">units</span></p>
                  <p className="text-xs text-muted mt-1">{formatCurrency(b.stockValue)} value</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
