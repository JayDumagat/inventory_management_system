import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Skeleton, SkeletonCard, SkeletonTable } from "../../components/ui/Skeleton";
import { formatCurrency } from "../../lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import {
  BarChart2, Package, Warehouse, TrendingUp, AlertTriangle, ShoppingCart,
} from "lucide-react";
import { cn } from "../../lib/utils";

type Tab = "sales" | "inventory" | "products";

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

function formatDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function ReportsPage() {
  const { currentTenant } = useTenantStore();
  const tid = currentTenant?.id;
  const [tab, setTab] = useState<Tab>("sales");

  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [dateFrom, setDateFrom] = useState(formatDateInput(thirtyAgo));
  const [dateTo, setDateTo] = useState(formatDateInput(today));

  const { data: sales, isLoading: salesLoading } = useQuery<SalesReport>({
    queryKey: ["reports-sales", tid, dateFrom, dateTo],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/sales?from=${dateFrom}&to=${dateTo}`).then((r) => r.data),
    enabled: !!tid && tab === "sales",
  });

  const { data: inv, isLoading: invLoading } = useQuery<InventoryReport>({
    queryKey: ["reports-inventory", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/inventory`).then((r) => r.data),
    enabled: !!tid && tab === "inventory",
  });

  const { data: prods, isLoading: prodsLoading } = useQuery<ProductsReport>({
    queryKey: ["reports-products", tid, dateFrom, dateTo],
    queryFn: () => api.get(`/api/tenants/${tid}/reports/products?from=${dateFrom}&to=${dateTo}`).then((r) => r.data),
    enabled: !!tid && tab === "products",
  });

  const tabs: { key: Tab; label: string; icon: typeof BarChart2 }[] = [
    { key: "sales", label: "Sales", icon: TrendingUp },
    { key: "inventory", label: "Inventory", icon: Warehouse },
    { key: "products", label: "Products", icon: Package },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Reports</h1>
        <p className="text-muted text-sm mt-1">Analytics and insights for your business</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-stroke">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Date range (sales + products tabs) */}
      {(tab === "sales" || tab === "products") && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted font-medium">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-stroke px-3 py-1.5 text-sm bg-panel text-ink outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted font-medium">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-stroke px-3 py-1.5 text-sm bg-panel text-ink outline-none focus:border-primary-500"
            />
          </div>
        </div>
      )}

      {/* SALES TAB */}
      {tab === "sales" && (
        salesLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total orders", value: sales?.summary.totalOrders ?? 0, icon: ShoppingCart, color: "text-blue-600 bg-blue-50 border-blue-200" },
                { label: "Total revenue", value: formatCurrency(sales?.summary.totalRevenue ?? 0), icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200" },
                { label: "Avg order value", value: formatCurrency(sales?.summary.avgOrderValue ?? 0), icon: BarChart2, color: "text-primary-600 bg-primary-50 border-primary-200" },
              ].map((s) => (
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

            <Card>
              <CardHeader>
                <CardTitle>Revenue by day</CardTitle>
              </CardHeader>
              <CardContent>
                {(sales?.byDay?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted text-sm">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                    No sales data for this period
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={sales?.byDay ?? []}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-500)" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="var(--accent-500)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clr)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="var(--border-clr)" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} stroke="var(--border-clr)" />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                      <Area type="monotone" dataKey="revenue" stroke="var(--accent-500)" strokeWidth={2} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders by day</CardTitle>
              </CardHeader>
              <CardContent>
                {(sales?.byDay?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted text-sm">No data</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={sales?.byDay ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-clr)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} stroke="var(--border-clr)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--border-clr)" />
                      <Tooltip />
                      <Bar dataKey="orderCount" fill="var(--accent-500)" name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* INVENTORY TAB */}
      {tab === "inventory" && (
        invLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="border border-stroke">
              <table className="w-full"><SkeletonTable rows={6} cols={3} /></table>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Total units", value: inv?.summary.totalUnits ?? 0, icon: Warehouse, color: "text-primary-600 bg-primary-50 border-primary-200" },
                { label: "Stock value", value: formatCurrency(inv?.summary.totalValue ?? 0), icon: TrendingUp, color: "text-green-600 bg-green-50 border-green-200" },
                { label: "Low stock items", value: inv?.summary.lowStockCount ?? 0, icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
              ].map((s) => (
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

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Card>
                <CardHeader><CardTitle>Stock by branch</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {(inv?.byBranch?.length ?? 0) === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted">No data</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stroke text-left">
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted">Branch</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Units</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv?.byBranch.map((b) => (
                          <tr key={b.branchId} className="border-b border-stroke last:border-0">
                            <td className="px-5 py-2.5 font-medium text-ink">{b.branchName}</td>
                            <td className="px-5 py-2.5 text-right text-muted">{b.totalUnits.toLocaleString()}</td>
                            <td className="px-5 py-2.5 text-right font-medium text-ink">{formatCurrency(b.stockValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Stock by category</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {(inv?.byCategory?.length ?? 0) === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-muted">No data</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stroke text-left">
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted">Category</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Units</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv?.byCategory.map((c) => (
                          <tr key={c.categoryId} className="border-b border-stroke last:border-0">
                            <td className="px-5 py-2.5 font-medium text-ink">{c.categoryName}</td>
                            <td className="px-5 py-2.5 text-right text-muted">{c.totalUnits.toLocaleString()}</td>
                            <td className="px-5 py-2.5 text-right font-medium text-ink">{formatCurrency(c.stockValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>

            {(inv?.lowStock?.length ?? 0) > 0 && (
              <Card>
                <CardHeader><CardTitle>Low stock items</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-stroke text-left">
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted">Product</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted">SKU</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted">Branch</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Qty</th>
                          <th className="px-5 py-2.5 text-xs font-semibold text-muted text-right">Reorder at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv?.lowStock.map((item) => (
                          <tr key={item.inventoryId} className="border-b border-stroke last:border-0 hover:bg-hover">
                            <td className="px-5 py-2.5 font-medium text-ink">
                              {item.productName} — {item.variantName}
                            </td>
                            <td className="px-5 py-2.5 font-mono text-xs text-muted">{item.sku}</td>
                            <td className="px-5 py-2.5 text-muted">{item.branchName}</td>
                            <td className="px-5 py-2.5 text-right">
                              <Badge variant="danger">{item.quantity}</Badge>
                            </td>
                            <td className="px-5 py-2.5 text-right text-muted">{item.reorderPoint}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {/* PRODUCTS TAB */}
      {tab === "products" && (
        prodsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-7 w-40" />
            <div className="border border-stroke">
              <table className="w-full"><SkeletonTable rows={6} cols={4} /></table>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Top products by quantity sold</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(prods?.products?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted text-sm">
                  <Package className="w-8 h-8 mb-2 opacity-30" />
                  No sales data for this period
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stroke text-left">
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">#</th>
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Product</th>
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">Variant</th>
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider">SKU</th>
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-right">Qty Sold</th>
                        <th className="px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wider text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prods?.products.map((p, i) => (
                        <tr key={`${p.productId}-${p.sku}`} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                          <td className="px-5 py-3 text-muted">{i + 1}</td>
                          <td className="px-5 py-3 font-medium text-ink">{p.productName}</td>
                          <td className="px-5 py-3 text-muted">{p.variantName}</td>
                          <td className="px-5 py-3 font-mono text-xs text-muted">{p.sku}</td>
                          <td className="px-5 py-3 text-right font-bold text-ink">{p.totalQty.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right font-medium text-ink">{formatCurrency(p.totalRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
