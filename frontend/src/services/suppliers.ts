import { api } from "../api/client";
import type { Supplier } from "../types";

export const suppliersService = {
  list: (tenantId: string) =>
    api.get<Supplier[]>(`/api/tenants/${tenantId}/suppliers`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post<Supplier>(`/api/tenants/${tenantId}/suppliers`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Supplier>(`/api/tenants/${tenantId}/suppliers/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/suppliers/${id}`).then((r) => r.data),
};
