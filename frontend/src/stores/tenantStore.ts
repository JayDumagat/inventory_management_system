import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  taxRate?: string;
  role: string;
  allowedPages?: string[] | null;
  plan?: string;
  receiptTemplate?: "compact" | "detailed";
  receiptFooterMessage?: string;
  // Philippine regulatory compliance fields
  tinNumber?: string | null;
  isVatRegistered?: boolean;
  businessType?: string | null;
  businessAddress?: string | null;
  businessCity?: string | null;
  businessCountry?: string | null;
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
