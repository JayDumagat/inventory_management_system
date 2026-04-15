import { api } from "../api/client";
import type { AuditLog } from "../types";

export const auditLogsService = {
  list: (tenantId: string) =>
    api.get<AuditLog[]>(`/api/tenants/${tenantId}/audit-logs`).then((r) => r.data),
};
