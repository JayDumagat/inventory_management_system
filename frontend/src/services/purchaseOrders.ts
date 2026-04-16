import { api } from "../api/client";
import type { PurchaseOrder } from "../types";

export const purchaseOrdersService = {
  list: (tenantId: string, branchId?: string) =>
    api.get<PurchaseOrder[]>(`/api/tenants/${tenantId}/purchase-orders`, { params: { branchId } }).then((r) => r.data),
  get: (tenantId: string, id: string) =>
    api.get<PurchaseOrder>(`/api/tenants/${tenantId}/purchase-orders/${id}`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/purchase-orders`, data).then((r) => r.data),
  updateStatus: (tenantId: string, id: string, status: string) =>
    api.patch(`/api/tenants/${tenantId}/purchase-orders/${id}`, { status }).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/purchase-orders/${id}`).then((r) => r.data),
};
