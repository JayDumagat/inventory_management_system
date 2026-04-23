import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useThemeStore } from "../stores/themeStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BASE_CURRENCY = "USD";
const SYMBOL_TO_CURRENCY: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₱": "PHP",
  "C$": "CAD",
  "A$": "AUD",
  "S$": "SGD",
  "CN¥": "CNY",
};
// 1 USD = rate amount of target currency
const FX_RATES_FROM_USD: Record<string, number> = {
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

function parseAmountWithCurrency(value: number | string): { amount: number; currency: string } {
  if (typeof value === "number") {
    return { amount: value, currency: BASE_CURRENCY };
  }

  const raw = value.trim();
  if (!raw) return { amount: 0, currency: BASE_CURRENCY };

  const codeMatch = raw.match(/\b([A-Z]{3})\b/);
  const code = codeMatch?.[1];
  if (code && FX_RATES_FROM_USD[code]) {
    const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
    return { amount: Number.isFinite(numeric) ? numeric : 0, currency: code };
  }

  const symbol = Object.keys(SYMBOL_TO_CURRENCY)
    .sort((a, b) => b.length - a.length)
    .find((s) => raw.includes(s));
  const detected = symbol ? SYMBOL_TO_CURRENCY[symbol] : BASE_CURRENCY;
  const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
  return { amount: Number.isFinite(numeric) ? numeric : 0, currency: detected };
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = FX_RATES_FROM_USD[fromCurrency] ?? FX_RATES_FROM_USD[BASE_CURRENCY];
  const toRate = FX_RATES_FROM_USD[toCurrency] ?? FX_RATES_FROM_USD[BASE_CURRENCY];
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

export function formatCurrency(amount: number | string, currencyOverride?: string) {
  const { currency: userCurrency, language } = useThemeStore.getState();
  const currency = currencyOverride ?? userCurrency;
  const parsed = parseAmountWithCurrency(amount);
  const converted = convertAmount(parsed.amount, parsed.currency, currency);
  const localeMap: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    ja: "ja-JP",
    zh: "zh-CN",
    pt: "pt-BR",
    ar: "ar-SA",
  };
  const locale = localeMap[language] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(converted);
}

export function formatDate(date: string | Date, timezoneOverride?: string) {
  const { timezone, dateFormat } = useThemeStore.getState();
  const tz = timezoneOverride ?? timezone;

  const parts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: tz,
  };

  if (dateFormat === "YYYY-MM-DD") {
    return new Intl.DateTimeFormat("sv-SE", { ...parts, month: "2-digit", day: "2-digit" }).format(new Date(date));
  }
  if (dateFormat === "DD/MM/YYYY") {
    return new Intl.DateTimeFormat("en-GB", parts).format(new Date(date));
  }
  return new Intl.DateTimeFormat("en-US", parts).format(new Date(date));
}

export function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Normalise a stored product image URL for browser use.
 *
 * When running under Docker Compose, `getPublicUrl` on the backend may have
 * already written the correct `/storage/…` path.  However, images that were
 * stored before `MINIO_PUBLIC_BASE_URL` was configured will have an internal
 * URL like `http://minio:9000/inventory-files/…` which the browser cannot
 * resolve.  This helper rewrites those internal URLs to go through the nginx
 * `/storage/` proxy, and returns all other URLs (relative paths, CDN URLs,
 * blob: URLs) unchanged.
 */

// Known container/service hostnames that are not browser-resolvable for end users.
const INTERNAL_SERVICE_HOSTNAMES = new Set([
  "minio",
  "backend",
  "frontend",
  "db",
  "redis",
  "host.docker.internal",
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
]);
const STORAGE_PREFIX = "/storage/";

function isPrivateIpHost(hostname: string): boolean {
  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

export function resolveImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith(STORAGE_PREFIX)) return url;
  if (url.startsWith("/inventory-files/")) return `/storage${url}`;
  if (url.startsWith("inventory-files/")) return `/storage/${url}`;
  try {
    const parsed = new URL(url);
    if (INTERNAL_SERVICE_HOSTNAMES.has(parsed.hostname) || isPrivateIpHost(parsed.hostname)) {
      const pathWithQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (parsed.pathname.startsWith(STORAGE_PREFIX)) return pathWithQuery;
      // Re-route through the nginx /storage/ proxy
      const normalizedPath = pathWithQuery.startsWith("/") ? pathWithQuery.slice(1) : pathWithQuery;
      return `${STORAGE_PREFIX}${normalizedPath}`;
    }
  } catch {
    // Not a valid absolute URL (relative path, blob:, etc.) – return as-is
  }
  return url;
}

export function formatDateTime(date: string | Date, timezoneOverride?: string) {
  const { timezone } = useThemeStore.getState();
  const tz = timezoneOverride ?? timezone;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(date));
}
