import { Request, Response } from "express";
import { uploadFile, getPresignedUrl, deleteFile, getPublicUrl } from "../lib/storage";
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES } from "../validators/upload";
import { buildTenantObjectName, isTenantOwnedObjectName } from "../lib/storageObjectName";

export const uploadFileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, mimeType, base64 } = req.body as {
      filename?: string;
      mimeType?: string;
      base64?: string;
    };

    if (!filename || !mimeType || !base64) {
      res.status(400).json({ error: "filename, mimeType, and base64 are required" });
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_SIZE_BYTES) {
      res.status(400).json({ error: "File exceeds 10 MB limit" });
      return;
    }

    const objectName = buildTenantObjectName(req.tenantContext!.tenantId, filename, mimeType);

    const result = await uploadFile(objectName, buffer, mimeType);
    if (!result) {
      res.status(503).json({ error: "Storage service unavailable" });
      return;
    }

    const url = getPublicUrl(objectName);
    res.status(201).json({ objectName, url });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPresignedUrlHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const objectName = req.query.object as string;
    if (!objectName) {
      res.status(400).json({ error: "object query param required" });
      return;
    }

    if (!isTenantOwnedObjectName(objectName, req.tenantContext!.tenantId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const url = await getPresignedUrl(objectName);
    if (!url) {
      res.status(503).json({ error: "Storage service unavailable" });
      return;
    }

    res.json({ url });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};

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

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
};
