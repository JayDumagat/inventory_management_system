import { api } from "../api/client";

export const tenantsService = {
  list: () =>
    api.get(`/api/tenants`).then((r) => r.data),
  get: (tenantId: string) =>
    api.get(`/api/tenants/${tenantId}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    api.post(`/api/tenants`, data).then((r) => r.data),
  update: (tenantId: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}`, data).then((r) => r.data),
  delete: (tenantId: string) =>
    api.delete(`/api/tenants/${tenantId}`).then((r) => r.data),
};
