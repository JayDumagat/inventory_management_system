import { api } from "../api/client";
import type { ApiKey } from "../types";

export const apiKeysService = {
  list: (tenantId: string) =>
    api.get<ApiKey[]>(`/api/tenants/${tenantId}/api-keys`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/api-keys`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/api-keys/${id}`).then((r) => r.data),
};
