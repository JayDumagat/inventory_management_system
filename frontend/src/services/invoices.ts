import { api } from "../api/client";
import type { Invoice, SalesOrder } from "../types";

export const invoicesService = {
  list: (tenantId: string) =>
    api.get<Invoice[]>(`/api/tenants/${tenantId}/invoices`).then((r) => r.data),
  listSalesOrders: (tenantId: string) =>
    api.get<SalesOrder[]>(`/api/tenants/${tenantId}/sales-orders`).then((r) => r.data),
  create: (tenantId: string, data: object) =>
    api.post(`/api/tenants/${tenantId}/invoices`, data).then((r) => r.data),
  createFromOrder: (tenantId: string, orderId: string) =>
    api.post(`/api/tenants/${tenantId}/invoices/from-order/${orderId}`).then((r) => r.data),
  updateStatus: (tenantId: string, id: string, status: string) =>
    api.patch(`/api/tenants/${tenantId}/invoices/${id}`, { status }).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/invoices/${id}`).then((r) => r.data),
};
