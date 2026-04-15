import { api } from "../api/client";
import type { Integration } from "../types";

export const integrationsService = {
  list: (tenantId: string) =>
    api.get<Integration[]>(`/api/tenants/${tenantId}/integrations`).then((r) => r.data),
  upsert: (tenantId: string, provider: string, data: Record<string, unknown>) =>
    api.put(`/api/tenants/${tenantId}/integrations/${provider}`, data).then((r) => r.data),
};
