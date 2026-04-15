import { api } from "../api/client";
import type { Customer } from "../types";

export const customersService = {
  list: (tenantId: string) =>
    api.get<Customer[]>(`/api/tenants/${tenantId}/customers`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post<Customer>(`/api/tenants/${tenantId}/customers`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Customer>(`/api/tenants/${tenantId}/customers/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/customers/${id}`).then((r) => r.data),
};
