import { api } from "../api/client";
import type { Transaction } from "../types";

export const transactionsService = {
  list: (tenantId: string, branchId?: string) =>
    api.get<Transaction[]>(`/api/tenants/${tenantId}/transactions`, { params: { branchId } }).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/transactions`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/transactions/${id}`).then((r) => r.data),
};
