import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  role: string;
}

interface TenantState {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentTenant: null,
      setCurrentTenant: (tenant) => {
        if (tenant) {
          localStorage.setItem("currentTenantId", tenant.id);
        } else {
          localStorage.removeItem("currentTenantId");
        }
        set({ currentTenant: tenant });
      },
    }),
    { name: "tenant-storage" }
  )
);
