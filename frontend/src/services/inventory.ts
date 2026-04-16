import { api } from "../api/client";
import type { InventoryItem, Movement, Batch } from "../types";

export const inventoryService = {
  list: (tenantId: string, branchId?: string) =>
    api.get<InventoryItem[]>(`/api/tenants/${tenantId}/inventory`, { params: { branchId } }).then((r) => r.data),
  listMovements: (tenantId: string, branchId?: string) =>
    api.get<Movement[]>(`/api/tenants/${tenantId}/inventory/movements`, { params: { branchId } }).then((r) => r.data),
  adjust: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/inventory/adjust`, data).then((r) => r.data),
  transfer: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/inventory/transfer`, data).then((r) => r.data),
  lookupBarcode: (tenantId: string, code: string) =>
    api.get(`/api/tenants/${tenantId}/inventory/barcode/${encodeURIComponent(code)}`).then((r) => r.data),
};

export const batchesService = {
  list: (tenantId: string, branchId?: string) =>
    api.get<Batch[]>(`/api/tenants/${tenantId}/batches`, { params: { branchId } }).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/batches`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}/batches/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/batches/${id}`).then((r) => r.data),
};
