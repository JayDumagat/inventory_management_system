import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../api/client";
import type { SuperadminUser } from "../types";

interface SuperadminState {
  superadmin: SuperadminUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string, user: SuperadminUser) => void;
}

export const useSuperadminStore = create<SuperadminState>()(
  persist(
    (set) => ({
      superadmin: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await api.post("/api/superadmin/auth/login", { email, password });
        localStorage.setItem("superadminToken", data.accessToken);
        set({ superadmin: data.superadmin, accessToken: data.accessToken, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem("superadminToken");
        set({ superadmin: null, accessToken: null, isAuthenticated: false });
      },

      setToken: (token, user) => {
        localStorage.setItem("superadminToken", token);
        set({ accessToken: token, superadmin: user, isAuthenticated: true });
      },
    }),
    {
      name: "superadmin-storage",
      partialize: (s) => ({
        superadmin: s.superadmin,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
      }),
    },
  ),
);
