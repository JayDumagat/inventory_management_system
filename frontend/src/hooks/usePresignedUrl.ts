import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client";
import { useTenantStore } from "../stores/tenantStore";
import { getCachedPresignedUrl, setCachedPresignedUrl } from "../lib/presignedUrls";

/**
 * Fetch and cache a presigned MinIO GET URL for the given storage object name.
 *
 * Results are held in a module-level in-memory cache (55-minute TTL, matching
 * the backend Redis TTL) so that multiple components showing the same image
 * only cause a single network round-trip per cache window.
 *
 * @param objectName  The MinIO object key (e.g. `"<tenantId>-<uuid>.jpg"`).
 *                    Pass `undefined` / `null` to skip the fetch.
 */
export function usePresignedUrl(objectName: string | undefined | null) {
  const { currentTenant } = useTenantStore();
  const tenantId = currentTenant?.id;

  const cacheKey = tenantId && objectName ? `${tenantId}:${objectName}` : null;

  const [url, setUrl] = useState<string | null>(() =>
    cacheKey ? getCachedPresignedUrl(cacheKey) : null
  );

  useEffect(() => {
    if (!cacheKey || !tenantId || !objectName) return;

    const cached = getCachedPresignedUrl(cacheKey);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;

    api
      .get(`/api/tenants/${tenantId}/uploads/presign`, {
        params: { object: objectName },
      })
      .then((r) => {
        if (cancelled) return;
        const presignedUrl = r.data.url as string;
        setCachedPresignedUrl(cacheKey, presignedUrl);
        setUrl(presignedUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, objectName, tenantId]);

  /**
   * Force-refresh the presigned URL, bypassing the client-side cache.
   * Useful to call after receiving a 403 on an `<img>` load.
   */
  const refresh = useCallback(async (): Promise<string | null> => {
    if (!cacheKey || !tenantId || !objectName) return null;
    try {
      const r = await api.get(`/api/tenants/${tenantId}/uploads/presign`, {
        params: { object: objectName },
      });
      const fresh = r.data.url as string;
      setCachedPresignedUrl(cacheKey, fresh);
      setUrl(fresh);
      return fresh;
    } catch {
      return null;
    }
  }, [cacheKey, objectName, tenantId]);

  return { url, refresh };
}
