import { api } from "../api/client";
import type { Notification } from "../types";

export const notificationsService = {
  list: (tenantId: string) =>
    api.get<Notification[]>(`/api/tenants/${tenantId}/notifications`).then((r) => r.data),
};
