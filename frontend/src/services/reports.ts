import { api } from "../api/client";
import type { SalesReport, InventoryReport, ProductsReport } from "../types";

export const reportsService = {
  sales: (tenantId: string, from: string, to: string) =>
    api.get<SalesReport>(`/api/tenants/${tenantId}/reports/sales?from=${from}&to=${to}`).then((r) => r.data),
  inventory: (tenantId: string) =>
    api.get<InventoryReport>(`/api/tenants/${tenantId}/reports/inventory`).then((r) => r.data),
  products: (tenantId: string, from: string, to: string) =>
    api.get<ProductsReport>(`/api/tenants/${tenantId}/reports/products?from=${from}&to=${to}`).then((r) => r.data),
};
