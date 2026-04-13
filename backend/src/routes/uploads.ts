import { Router, Request, Response } from "express";
import { authenticate, requireTenant } from "../middleware/auth";
import { uploadFile, getPresignedUrl, deleteFile, getPublicUrl } from "../lib/storage";
import { v4 as uuidv4 } from "uuid";

const router = Router({ mergeParams: true });

const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// POST /api/tenants/:tenantId/uploads
// Body: { filename: string, mimeType: string, base64: string }
router.post("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
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

    const ext = filename.split(".").pop() ?? "bin";
    const objectName = `${req.tenantContext!.tenantId}/${uuidv4()}.${ext}`;

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
});

// GET /api/tenants/:tenantId/uploads/presign?object=...
router.get("/presign", authenticate, requireTenant(), async (req: Request, res: Response): Promise<void> => {
  try {
    const objectName = req.query.object as string;
    if (!objectName) {
      res.status(400).json({ error: "object query param required" });
      return;
    }

    // Ensure the object belongs to this tenant
    if (!objectName.startsWith(`${req.tenantContext!.tenantId}/`)) {
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
});

// DELETE /api/tenants/:tenantId/uploads
// Body: { objectName: string }
router.delete("/", authenticate, requireTenant("manager"), async (req: Request, res: Response): Promise<void> => {
  try {
    const { objectName } = req.body as { objectName?: string };
    if (!objectName) {
      res.status(400).json({ error: "objectName is required" });
      return;
    }

    if (!objectName.startsWith(`${req.tenantContext!.tenantId}/`)) {
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
});

export default router;
