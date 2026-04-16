import { api } from "../api/client";
import type { Order } from "../types";

export const ordersService = {
  list: (tenantId: string, branchId?: string) =>
    api.get<Order[]>(`/api/tenants/${tenantId}/sales-orders`, { params: { branchId } }).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/sales-orders`, data).then((r) => r.data),
  updateStatus: (tenantId: string, id: string, status: string) =>
    api.patch(`/api/tenants/${tenantId}/sales-orders/${id}`, { status }).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/sales-orders/${id}`).then((r) => r.data),
  refund: (tenantId: string, id: string, amount: number, reason: string) =>
    api.post(`/api/tenants/${tenantId}/sales-orders/${id}/refund`, { amount, reason }).then((r) => r.data),
};
