import { api } from "../api/client";
import type { Product, Category, Unit } from "../types";

export const productsService = {
  list: (tenantId: string) =>
    api.get<Product[]>(`/api/tenants/${tenantId}/products`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/products`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}/products/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/products/${id}`).then((r) => r.data),
};

export const categoriesService = {
  list: (tenantId: string) =>
    api.get<Category[]>(`/api/tenants/${tenantId}/categories`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/categories`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}/categories/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/categories/${id}`).then((r) => r.data),
};

export const unitsService = {
  list: (tenantId: string) =>
    api.get<Unit[]>(`/api/tenants/${tenantId}/units`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/api/tenants/${tenantId}/units`, data).then((r) => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) =>
    api.patch(`/api/tenants/${tenantId}/units/${id}`, data).then((r) => r.data),
  delete: (tenantId: string, id: string) =>
    api.delete(`/api/tenants/${tenantId}/units/${id}`).then((r) => r.data),
};
