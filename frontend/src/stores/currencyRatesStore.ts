import { create } from "zustand";
import { persist } from "zustand/middleware";

const RATES_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATES_API_URL = "https://open.er-api.com/v6/latest/USD";

interface CurrencyRatesState {
  rates: Record<string, number>;
  fetchedAt: number | null;
  fetchRates: () => Promise<void>;
  getRate: (from: string, to: string) => number;
}

// Fallback rates (1 USD = X target currency) used when the API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 156.2,
  CAD: 1.37,
  AUD: 1.52,
  CNY: 7.24,
  INR: 83.4,
  PHP: 57.2,
  SGD: 1.35,
};

export const useCurrencyRatesStore = create<CurrencyRatesState>()(
  persist(
    (set, get) => ({
      rates: FALLBACK_RATES,
      fetchedAt: null,

      fetchRates: async () => {
        const { fetchedAt } = get();
        // Skip if rates were fetched within the TTL window
        if (fetchedAt !== null && Date.now() - fetchedAt < RATES_TTL_MS) {
          return;
        }
        try {
          const res = await fetch(RATES_API_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json() as { rates?: unknown };
          if (
            data.rates !== null &&
            typeof data.rates === "object" &&
            !Array.isArray(data.rates)
          ) {
            const rates = data.rates as Record<string, unknown>;
            const validated: Record<string, number> = {};
            for (const [key, val] of Object.entries(rates)) {
              if (typeof val === "number" && Number.isFinite(val)) {
                validated[key] = val;
              }
            }
            set({ rates: { ...FALLBACK_RATES, ...validated }, fetchedAt: Date.now() });
          }
        } catch {
          // Keep existing (or fallback) rates on network error
        }
      },

      getRate: (from: string, to: string): number => {
        const { rates } = get();
        const fromRate = rates[from] ?? FALLBACK_RATES[from] ?? 1;
        const toRate = rates[to] ?? FALLBACK_RATES[to] ?? 1;
        // Rates are all relative to USD; convert via USD
        return toRate / fromRate;
      },
    }),
    { name: "currency-rates-storage" }
  )
);
