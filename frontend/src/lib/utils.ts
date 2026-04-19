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
