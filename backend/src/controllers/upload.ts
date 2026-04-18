import { Request, Response } from "express";
import { uploadFile, getPresignedUrl, deleteFile } from "../lib/storage";
import { buildTenantObjectName, isTenantOwnedObjectName } from "../lib/storageObjectName";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis";

// Presigned URLs are valid for 1 hour; cache them for 55 minutes to provide a
// 5-minute buffer before expiry and avoid serving stale URLs.
const PRESIGN_EXPIRY_SECONDS = 3600;
const PRESIGN_CACHE_TTL_SECONDS = 3300;
const BATCH_PRESIGN_MAX = 50;

export function presignCacheKey(tenantId: string, objectName: string): string {
  return `presign:${tenantId}:${objectName}`;
}

async function getOrCachePresignedUrl(tenantId: string, objectName: string): Promise<string | null> {
  const key = presignCacheKey(tenantId, objectName);
  const cached = await cacheGet<string>(key);
  if (cached) return cached;

  const url = await getPresignedUrl(objectName, undefined, PRESIGN_EXPIRY_SECONDS);
  if (url) {
    await cacheSet(key, url, PRESIGN_CACHE_TTL_SECONDS);
  }
  return url;
}

// POST / — multipart/form-data upload via Multer (req.file populated by middleware)
export const uploadFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "File is required" });
      return;
    }

    const { originalname, mimetype, buffer } = req.file;
    const objectName = buildTenantObjectName(req.tenantContext!.tenantId, originalname, mimetype);

    const result = await uploadFile(objectName, buffer, mimetype);
    if (!result) {
      res.status(503).json({ error: "Storage service unavailable" });
      return;
    }

    res.status(201).json({ objectName });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /presign?object=<objectName> — return a short-lived presigned GET URL,
// served from Redis cache when available.
export const getPresignedUrlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const objectName = req.query.object;
    if (typeof objectName !== "string" || !objectName) {
      res.status(400).json({ error: "object query param required" });
      return;
    }

    if (!isTenantOwnedObjectName(objectName, req.tenantContext!.tenantId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const url = await getOrCachePresignedUrl(req.tenantContext!.tenantId, objectName);
    if (!url) {
      res.status(503).json({ error: "Storage service unavailable" });
      return;
    }

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /presign-batch — resolve presigned URLs for multiple objects in one request.
// Body: { objectNames: string[] }
// Response: { urls: Record<objectName, presignedUrl> }
export const batchPresignedUrlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { objectNames } = req.body as { objectNames?: unknown };
    if (!Array.isArray(objectNames) || objectNames.length === 0) {
      res.status(400).json({ error: "objectNames array is required" });
      return;
    }
    if (objectNames.length > BATCH_PRESIGN_MAX) {
      res.status(400).json({ error: `Maximum batch size is ${BATCH_PRESIGN_MAX}` });
      return;
    }

    const tenantId = req.tenantContext!.tenantId;

    // Validate ownership of all object names
    const validNames = objectNames.filter((n): n is string =>
      typeof n === "string" && isTenantOwnedObjectName(n, tenantId)
    );

    const urls: Record<string, string> = {};
    await Promise.all(
      validNames.map(async (objectName) => {
        const url = await getOrCachePresignedUrl(tenantId, objectName);
        if (url) urls[objectName] = url;
      })
    );

    res.json({ urls });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE / — remove a file from MinIO and invalidate its presigned URL cache.
export const deleteFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { objectName } = req.body as { objectName?: string };
    if (!objectName) {
      res.status(400).json({ error: "objectName is required" });
      return;
    }

    if (!isTenantOwnedObjectName(objectName, req.tenantContext!.tenantId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const ok = await deleteFile(objectName);
    if (!ok) {
      res.status(503).json({ error: "Storage service unavailable or file not found" });
      return;
    }

    // Invalidate cached presigned URL so subsequent requests don't get stale URLs.
    await cacheDel(presignCacheKey(req.tenantContext!.tenantId, objectName));

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
