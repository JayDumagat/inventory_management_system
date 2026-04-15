import { api } from "../api/client";
import type { Branch } from "../types";

export const branchesService = {
  list: (tenantId: string) =>
    api.get<Branch[]>(`/api/tenants/${tenantId}/branches`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post<Branch>(`/api/tenants/${tenantId}/branches`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Branch>(`/api/tenants/${tenantId}/branches/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/branches/${id}`).then((r) => r.data),
};
