/**
 * In-memory client-side cache for presigned MinIO GET URLs.
 *
 * Presigned URLs on the backend are valid for 60 minutes.  We cache them for
 * 55 minutes so that there is a 5-minute buffer before the URL can expire
 * while it is still in use.  Cache entries are keyed by
 * `"<tenantId>:<objectName>"` and are stored globally for the lifetime of the
 * browser tab.
 */

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const presignedUrlCache = new Map<string, CacheEntry>();

// 55 minutes in milliseconds
const CLIENT_CACHE_TTL_MS = 55 * 60 * 1000;

export function getCachedPresignedUrl(key: string): string | null {
  const entry = presignedUrlCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    presignedUrlCache.delete(key);
    return null;
  }
  return entry.url;
}

export function setCachedPresignedUrl(key: string, url: string): void {
  presignedUrlCache.set(key, { url, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS });
}

export function clearCachedPresignedUrl(key: string): void {
  presignedUrlCache.delete(key);
}
