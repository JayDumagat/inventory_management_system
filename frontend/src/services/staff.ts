import { api } from "../api/client";
import type { StaffMember } from "../types";

export const staffService = {
  list: (tenantId: string) =>
    api.get<StaffMember[]>(`/api/tenants/${tenantId}/staff`).then((r) => r.data),
  invite: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/staff`, data).then((r) => r.data),
  remove: (tenantId: string, staffId: string) =>
    api.delete(`/api/tenants/${tenantId}/staff/${staffId}`).then((r) => r.data),
  update: (tenantId: string, staffId: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}/staff/${staffId}`, data).then((r) => r.data),
  addBranch: (tenantId: string, staffId: string, branchId: string) =>
    api.post(`/api/tenants/${tenantId}/staff/${staffId}/branches`, { branchId }).then((r) => r.data),
  removeBranch: (tenantId: string, staffId: string, branchId: string) =>
    api.delete(`/api/tenants/${tenantId}/staff/${staffId}/branches/${branchId}`).then((r) => r.data),
};
