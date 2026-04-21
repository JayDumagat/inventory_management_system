import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor =
  | "olive" | "ocean" | "coastal"
  | "blue" | "violet" | "emerald" | "rose" | "amber" | "teal" | "noir";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  timezone: string;
  currency: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  language: string;
  compactMode: boolean;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setTimezone: (timezone: string) => void;
  setCurrency: (currency: string) => void;
  setDateFormat: (format: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD") => void;
  setLanguage: (language: string) => void;
  setCompactMode: (compact: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accent: "olive",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      currency: "USD",
      dateFormat: "MM/DD/YYYY",
      language: "en",
      compactMode: false,
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setTimezone: (timezone) => set({ timezone }),
      setCurrency: (currency) => set({ currency }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setLanguage: (language) => set({ language }),
      setCompactMode: (compactMode) => set({ compactMode }),
    }),
    { name: "theme-storage" }
  )
);
