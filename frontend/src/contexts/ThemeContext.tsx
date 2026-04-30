import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useThemeStore, type ThemeMode, type AccentColor } from "../stores/themeStore";
import { useCurrencyRatesStore } from "../stores/currencyRatesStore";

interface ThemeContextValue {
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

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ALL_THEMES: AccentColor[] = [
  "olive", "ocean", "coastal",
  "blue", "violet", "emerald", "rose", "amber", "teal", "noir"
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const store = useThemeStore();
  const { mode, accent } = store;
  const fetchRates = useCurrencyRatesStore((s) => s.fetchRates);

  // Fetch live exchange rates on mount (and whenever the currency changes)
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  useEffect(() => {
    const root = document.documentElement;

    ALL_THEMES.forEach((t) => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${accent}`);

    const applyDark = (dark: boolean) => {
      root.classList.toggle("dark", dark);
    };

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      applyDark(mode === "dark");
    }
  }, [mode, accent]);

  return (
    <ThemeContext.Provider value={store}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
