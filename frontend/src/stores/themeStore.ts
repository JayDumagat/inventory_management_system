import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "violet" | "emerald" | "rose" | "amber" | "teal";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  timezone: string;
  currency: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setTimezone: (timezone: string) => void;
  setCurrency: (currency: string) => void;
  setDateFormat: (format: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD") => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accent: "blue",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setTimezone: (timezone) => set({ timezone }),
      setCurrency: (currency) => set({ currency }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
    }),
    { name: "theme-storage" }
  )
);
