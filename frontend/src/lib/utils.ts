import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useThemeStore } from "../stores/themeStore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currencyOverride?: string) {
  const currency = currencyOverride ?? useThemeStore.getState().currency;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount));
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
export function resolveImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Internal Docker service hostnames have no dots (e.g. "minio", "backend").
    // Localhost is directly accessible from the developer's browser, so leave it alone.
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      // Re-route through the nginx /storage/ proxy: strip the leading origin
      return `/storage${parsed.pathname}`;
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
